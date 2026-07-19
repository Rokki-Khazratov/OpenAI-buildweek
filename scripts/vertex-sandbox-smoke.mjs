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

console.log(JSON.stringify({
  status: "passed",
  sandbox_email: email,
  exam_id: exam.id,
  artifact_id: artifact.id,
  generator: mock.generator,
  questions: mock.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    citations: question.citations.length,
  })),
}, null, 2));
