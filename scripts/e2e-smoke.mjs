const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const cookies = new Map();

function storeCookies(response) {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";", 1)[0];
    const separator = pair.indexOf("=");
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(cookies.size ? { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") } : {}),
      ...init.headers,
    },
  });
  storeCookies(response);
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} returned ${response.status}: ${await response.text()}`);
  }
  return response.status === 204 ? undefined : response.json();
}

const unique = Date.now();
await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "CI Student",
    email: `ci-${unique}@example.com`,
    password: "Buildweek123!",
  }),
});

const subject = await request("/api/backend/subjects", {
  method: "POST",
  body: JSON.stringify({ title: "CI Subject", course_code: "CI-101", visibility: "private" }),
});
const exam = await request(`/api/backend/subjects/${subject.id}/exams`, {
  method: "POST",
  body: JSON.stringify({
    title: "CI Final",
    exam_type: "Written final",
    language: "en",
    pasted_context: "CI P0 smoke context",
    sources: [],
    blueprint: [{ id: "part-a", title: "Part A", questionType: "Open response", questionCount: 2, durationMinutes: 20, points: 20 }],
    rules: { durationMinutes: 20, totalPoints: 20, passPercentage: 50, penalty: "None", allowedMaterials: "None", gradingNotes: "Show reasoning" },
    scenario: { mode: "full_exam", difficulty: "matched", instructions: "Deterministic CI mock" },
  }),
});
if (exam.status !== "ready") throw new Error(`Expected ready exam, received ${exam.status}`);

const artifactContent = Buffer.from("ExamTwin E2E artifact content for the summary preview. ".repeat(20));
const uploadSession = await request(`/api/backend/exams/${exam.id}/artifacts/uploads`, {
  method: "POST",
  body: JSON.stringify({
    filename: "e2e-context.txt",
    kind: "notes",
    media_type: "text/plain",
    size_bytes: artifactContent.length,
  }),
});
const storageUpload = await fetch(uploadSession.upload.url, {
  method: "PUT",
  headers: uploadSession.upload.headers,
  body: artifactContent,
});
if (!storageUpload.ok) {
  throw new Error(`Artifact storage upload failed: ${storageUpload.status} ${await storageUpload.text()}`);
}
await request(`/api/backend/artifacts/${uploadSession.artifact.id}/complete`, { method: "POST" });

let uploadedArtifact;
for (let poll = 0; poll < 30; poll += 1) {
  uploadedArtifact = await request(`/api/backend/artifacts/${uploadSession.artifact.id}`);
  if (uploadedArtifact.processing_status === "ready" || uploadedArtifact.processing_status === "failed") break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (uploadedArtifact?.processing_status !== "ready") {
  throw new Error(`Artifact did not become ready: ${JSON.stringify(uploadedArtifact)}`);
}
const artifactSummary = await request(`/api/backend/artifacts/${uploadedArtifact.id}/content-summary`);
if (!artifactSummary.preview.includes("ExamTwin E2E artifact")) {
  throw new Error(`Artifact content summary was not available: ${JSON.stringify(artifactSummary)}`);
}

const statisticsBeforeSubmit = await request(`/api/backend/exams/${exam.id}/statistics`);
if (statisticsBeforeSubmit.attempt_count !== 0 || statisticsBeforeSubmit.latest_percentage !== null) {
  throw new Error(`New exam statistics should be empty: ${JSON.stringify(statisticsBeforeSubmit)}`);
}

const mock = await request(`/api/backend/exams/${exam.id}/mocks`, { method: "POST" });
if (mock.questions.length !== 2) throw new Error("Mock did not follow the blueprint question count");
const attempt = await request(`/api/backend/mocks/${mock.id}/attempts`, { method: "POST" });
const questionId = attempt.mock_exam.questions[0].id;
await request(`/api/backend/attempts/${attempt.id}/responses/${questionId}`, {
  method: "PUT",
  body: JSON.stringify({ answer: "A complete CI response with clear reasoning.", flagged: false }),
});
const resumed = await request(`/api/backend/attempts/${attempt.id}`);
if (resumed.responses[0]?.answer !== "A complete CI response with clear reasoning.") throw new Error("Autosaved response was not restored");
const result = await request(`/api/backend/attempts/${attempt.id}/submit`, { method: "POST" });
const repeated = await request(`/api/backend/attempts/${attempt.id}/submit`, { method: "POST" });
if (result.score !== repeated.score || result.submitted_at !== repeated.submitted_at) throw new Error("Submit is not idempotent");
const statistics = await request(`/api/backend/exams/${exam.id}/statistics`);
if (statistics.attempt_count !== statisticsBeforeSubmit.attempt_count + 1) {
  throw new Error("Submitted attempt is missing from statistics");
}
if (statistics.latest_percentage !== result.percentage) {
  throw new Error(`Latest percentage drifted: ${statistics.latest_percentage} != ${result.percentage}`);
}
const history = await request(`/api/backend/exams/${exam.id}/attempts`);
if (history[0]?.attempt_id !== attempt.id || history[0]?.percentage !== result.percentage) {
  throw new Error("Submitted attempt is missing or stale in history");
}

console.log(`P0 E2E smoke passed: ${subject.id} → ${exam.id} → ${attempt.id} → ${result.percentage}%`);
