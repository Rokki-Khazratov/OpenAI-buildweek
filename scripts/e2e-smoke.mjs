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
if (statistics.attempt_count !== 1) throw new Error("Submitted attempt is missing from statistics");

console.log(`P0 E2E smoke passed: ${subject.id} → ${exam.id} → ${attempt.id} → ${result.percentage}%`);
