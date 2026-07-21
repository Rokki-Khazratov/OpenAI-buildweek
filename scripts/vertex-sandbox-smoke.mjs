const api = process.env.API_URL ?? "http://127.0.0.1:8020/api/v1";
const unique = Date.now();
const email = `vertex-sandbox-${unique}@example.com`;
const password = "correct horse battery staple";

async function request(path, init = {}, token) {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? undefined : response.json();
}

await request("/auth/register", {
  method: "POST",
  body: JSON.stringify({ email, password, display_name: "Vertex Sandbox" }),
});
const login = await fetch(`${api}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ username: email, password }),
});
if (!login.ok) throw new Error(`Login failed: ${login.status} ${await login.text()}`);
const { access_token: token } = await login.json();

const subject = await request(
  "/subjects",
  { method: "POST", body: JSON.stringify({ title: "Vertex AI Sandbox" }) },
  token,
);
const exam = await request(
  `/subjects/${subject.id}/exams`,
  {
    method: "POST",
    body: JSON.stringify({
      title: "Thermodynamics grounded mock",
      language: "en",
      blueprint: [
        {
          id: "thermo",
          title: "Thermodynamics",
          questionType: "Open response",
          questionCount: 2,
          durationMinutes: 20,
          points: 20,
        },
      ],
      rules: { durationMinutes: 20, totalPoints: 20, passPercentage: 50 },
      scenario: { mode: "full_exam", difficulty: "matched", instructions: "Use the source." },
    }),
  },
  token,
);

const sourceText = [
  "At standard atmospheric pressure, pure water freezes at zero degrees Celsius.",
  "The first law of thermodynamics states that energy is conserved: change in internal energy equals heat added minus work done by the system.",
  "For an ideal gas, pressure times volume equals the amount of substance times the gas constant times absolute temperature.",
  "A reversible adiabatic process exchanges no heat with its surroundings.",
].join("\n\n").repeat(20);
const content = Buffer.from(sourceText);
const uploadSession = await request(
  `/exams/${exam.id}/artifacts/uploads`,
  {
    method: "POST",
    body: JSON.stringify({
      filename: "thermodynamics-source.txt",
      kind: "notes",
      media_type: "text/plain",
      size_bytes: content.length,
    }),
  },
  token,
);
const upload = await fetch(uploadSession.upload.url, {
  method: "PUT",
  headers: uploadSession.upload.headers,
  body: content,
});
if (!upload.ok) throw new Error(`Storage upload failed: ${upload.status} ${await upload.text()}`);
await request(`/artifacts/${uploadSession.artifact.id}/complete`, { method: "POST" }, token);

let artifact;
for (let poll = 0; poll < 120; poll += 1) {
  artifact = await request(`/artifacts/${uploadSession.artifact.id}`, {}, token);
  if (artifact.processing_status === "ready" || artifact.processing_status === "failed") break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (artifact?.processing_status !== "ready") {
  throw new Error(`Vertex artifact processing failed: ${JSON.stringify(artifact)}`);
}

const extraction = await request(
  `/exams/${exam.id}/blueprints/extractions`,
  {
    method: "POST",
    headers: { "Idempotency-Key": `vertex-blueprint-${unique}` },
    body: JSON.stringify({ artifact_ids: [artifact.id] }),
  },
  token,
);
if (extraction.status !== "draft") {
  throw new Error(`Blueprint extraction failed: ${JSON.stringify(extraction)}`);
}
let reviewedBlueprint = extraction;
if (extraction.content.unresolved_fields?.length) {
  reviewedBlueprint = await request(
    `/blueprints/${extraction.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        content: {
          ...extraction.content,
          rules: {
            ...extraction.content.rules,
            duration_minutes: extraction.content.rules.duration_minutes ?? 20,
            total_points: extraction.content.rules.total_points ?? 20,
            pass_percentage: extraction.content.rules.pass_percentage ?? 50,
          },
          unresolved_fields: [],
        },
      }),
    },
    token,
  );
}
const approved = await request(
  `/blueprints/${reviewedBlueprint.id}/approve`,
  { method: "POST" },
  token,
);
if (approved.status !== "approved") {
  throw new Error(`Blueprint approval failed: ${JSON.stringify(approved)}`);
}

const mock = await request(`/exams/${exam.id}/mocks`, { method: "POST" }, token);
if (!mock.generator.startsWith("vertex:gemini-3.5-flash")) {
  throw new Error(`Expected Vertex generator, received ${mock.generator}`);
}
if (mock.questions.length !== 2) {
  throw new Error(`Expected 2 questions, received ${mock.questions.length}`);
}
for (const question of mock.questions) {
  if (!question.prompt || !question.citations?.length) {
    throw new Error(`Question is not grounded: ${JSON.stringify(question)}`);
  }
  if (question.citations.some((citation) => citation.artifact_id !== artifact.id)) {
    throw new Error(`Question cites an unexpected artifact: ${JSON.stringify(question.citations)}`);
  }
}

const attempt = await request(
  `/mocks/${mock.id}/attempts`,
  { method: "POST" },
  token,
);
for (const question of mock.questions) {
  await request(
    `/attempts/${attempt.id}/responses/${question.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        answer: "The first law states that energy is conserved: the change in internal energy equals heat added minus work done. For an ideal gas PV = nRT, and a reversible adiabatic process exchanges no heat.",
        flagged: false,
      }),
    },
    token,
  );
}
const result = await request(
  `/attempts/${attempt.id}/submit`,
  { method: "POST", headers: { "Idempotency-Key": attempt.id } },
  token,
);
if (result.question_results.length !== mock.questions.length) {
  throw new Error(`Evaluation result is incomplete: ${JSON.stringify(result)}`);
}
if (result.question_results.some((item) => !item.strategy || item.confidence < 0 || item.confidence > 1)) {
  throw new Error(`Evaluation contract is invalid: ${JSON.stringify(result.question_results)}`);
}

const analytics = await request(`/exams/${exam.id}/analytics`, {}, token);
if (analytics.model_version !== "analytics.v2" || analytics.readiness.index === null) {
  throw new Error(`Analytics snapshot was not created: ${JSON.stringify(analytics)}`);
}
if (!analytics.adaptive.eligible || !analytics.adaptive.target_skill_ids.length) {
  throw new Error(`Adaptive targets are missing: ${JSON.stringify(analytics.adaptive)}`);
}
const adaptiveMock = await request(
  `/exams/${exam.id}/mocks`,
  { method: "POST", body: JSON.stringify({ mode: "adaptive" }) },
  token,
);
if (adaptiveMock.generation_metadata.generation_mode !== "adaptive") {
  throw new Error(`Adaptive generation metadata is missing: ${JSON.stringify(adaptiveMock)}`);
}
if (adaptiveMock.generation_metadata.policy_version !== "adaptive.v2") {
  throw new Error(`Adaptive policy version is missing: ${JSON.stringify(adaptiveMock.generation_metadata)}`);
}
if (adaptiveMock.generation_metadata.readiness_before !== analytics.readiness.index) {
  throw new Error("Adaptive mock did not preserve readiness_before.");
}

console.log(JSON.stringify({
  status: "passed",
  sandbox_email: email,
  exam_id: exam.id,
  artifact_id: artifact.id,
  blueprint_id: approved.id,
  blueprint_status: approved.status,
  generator: mock.generator,
  attempt_id: attempt.id,
  score: `${result.score}/${result.max_score}`,
  evaluator: result.evaluator,
  analytics_model_version: analytics.model_version,
  readiness: analytics.readiness.index,
  snapshot_id: analytics.snapshot_id,
  adaptive_mock_id: adaptiveMock.id,
  adaptive_targets: analytics.adaptive.target_skill_ids,
  policy_version: adaptiveMock.generation_metadata.policy_version,
  questions: mock.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    citations: question.citations.length,
  })),
}, null, 2));
