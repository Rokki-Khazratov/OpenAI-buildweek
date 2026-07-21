/** Idempotent normal-mode DS golden flow. Localhost API only. */
const api = process.env.API_URL ?? "http://localhost:8010/api/v1";
const host = new URL(api).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error("seed-ds-golden-flow.mjs only permits a localhost API target.");
}

const credentials = {
  email: "ds-golden@example.com",
  password: "correct horse battery staple",
};

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

async function authenticate() {
  const login = async () => {
    const response = await fetch(`${api}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: credentials.email, password: credentials.password }),
    });
    return response.ok ? response.json() : null;
  };
  let tokens = await login();
  if (!tokens) {
    await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...credentials, display_name: "DS Golden Flow" }),
    });
    tokens = await login();
  }
  if (!tokens) throw new Error("Could not authenticate golden-flow account.");
  return tokens.access_token;
}

const token = await authenticate();
const subjects = await request("/subjects?limit=100", {}, token);
let subject = subjects.items.find((item) => item.title === "DS Golden Dataset");
if (!subject) {
  subject = await request("/subjects", {
    method: "POST",
    body: JSON.stringify({ title: "DS Golden Dataset", course_code: "DS-GOLD", visibility: "private" }),
  }, token);
}

const examPage = await request(`/subjects/${subject.id}/exams?limit=100`, {}, token);
let exam = examPage.items.find((item) => item.title === "Adaptive analytics golden flow");
if (!exam) {
  const sections = [
    ["dynamic-programming", "Dynamic programming"],
    ["graph-algorithms", "Graph algorithms"],
    ["complexity", "Complexity"],
    ["recursion", "Recursion"],
  ].map(([id, title]) => ({
    id,
    title,
    questionType: "Open response",
    questionCount: 4,
    durationMinutes: 20,
    points: 25,
    skills: [id],
  }));
  exam = await request(`/subjects/${subject.id}/exams`, {
    method: "POST",
    body: JSON.stringify({
      title: "Adaptive analytics golden flow",
      description: "Local reproducible DS contract fixture.",
      exam_type: "Golden regression",
      language: "en",
      blueprint: sections,
      rules: { durationMinutes: 80, totalPoints: 100, passPercentage: 60 },
      scenario: { mode: "full_exam", difficulty: "matched", instructions: "Deterministic contract proof." },
    }),
  }, token);
}

let analytics = await request(`/exams/${exam.id}/analytics`, {}, token);
let createdAttempts = false;
if (analytics.attempt_ids.length < 3) {
  createdAttempts = true;
  const mock = await request(`/exams/${exam.id}/mocks`, { method: "POST" }, token);
  const patterns = [
    { "dynamic-programming": 1, "graph-algorithms": 4, complexity: 3, recursion: 0 },
    { "dynamic-programming": 2, "graph-algorithms": 3, complexity: 4, recursion: 0 },
    { "dynamic-programming": 3, "graph-algorithms": 2, complexity: 4, recursion: 3 },
  ];
  for (const pattern of patterns.slice(analytics.attempt_ids.length)) {
    const attempt = await request(`/mocks/${mock.id}/attempts`, { method: "POST" }, token);
    const used = {};
    for (const question of mock.questions) {
      const skill = question.skill_ids[0];
      used[skill] = (used[skill] ?? 0) + 1;
      const answered = used[skill] <= (pattern[skill] ?? 0);
      await request(`/attempts/${attempt.id}/responses/${question.id}`, {
        method: "PUT",
        body: JSON.stringify({
          answer: answered ? "A complete concept explanation with relevant reasoning and a verified final conclusion." : "",
          flagged: false,
        }),
      }, token);
    }
    await request(`/attempts/${attempt.id}/submit`, { method: "POST" }, token);
  }
  analytics = await request(`/exams/${exam.id}/analytics`, {}, token);
}

const rebuild = await request(`/exams/${exam.id}/analytics/rebuild`, { method: "POST" }, token);
const quality = await request(`/exams/${exam.id}/analytics/data-quality`, {}, token);
const adaptive = createdAttempts
  ? await request(`/exams/${exam.id}/mocks`, {
      method: "POST",
      body: JSON.stringify({ mode: "adaptive" }),
    }, token)
  : null;

console.log(JSON.stringify({
  status: "passed",
  exam_id: exam.id,
  attempt_ids: analytics.attempt_ids,
  model_version: analytics.model_version,
  readiness: analytics.readiness.index,
  confidence: analytics.readiness.confidence,
  trends: Object.fromEntries(analytics.skills.map((item) => [item.skill_id, item.trend])),
  priority_skill: analytics.adaptive.target_skill_ids[0] ?? null,
  adaptive_targets: analytics.adaptive.target_skill_ids,
  policy_version: analytics.adaptive.policy_version,
  adaptive_mock_id: adaptive?.id ?? null,
  snapshot_id: rebuild.snapshot_id,
  input_revision_hash: rebuild.input_revision_hash,
  data_quality_safe: quality.safe_to_publish,
}, null, 2));
