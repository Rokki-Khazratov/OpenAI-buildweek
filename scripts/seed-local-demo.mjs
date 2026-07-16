/** Local-only rich workspace seed. Requires the API at API_URL (default localhost:8010). */
const api = process.env.API_URL ?? "http://localhost:8010/api/v1";
export const credentials = { email: "alex.morgan@examtwin.app", password: "exam1234" };
const apiHost = new URL(api).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(apiHost)) {
  throw new Error("seed-local-demo.mjs only permits a localhost API target.");
}

async function request(path, init = {}, token) {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}

async function loginOrRegister() {
  const login = async () => {
    const response = await fetch(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ username: credentials.email, password: credentials.password }) });
    return response.ok ? response.json() : null;
  };
  let tokens = await login();
  if (!tokens) {
    await request("/auth/register", { method: "POST", body: JSON.stringify({ email: credentials.email, password: credentials.password, display_name: "Alex Morgan" }) });
    tokens = await login();
  }
  if (!tokens) throw new Error("Could not establish the local demo account.");
  return tokens.access_token;
}

const blueprint = (prefix, questions = 6) => [
  { id: `${prefix}-a`, title: "Core concepts", questionType: "Short answer", questionCount: questions, durationMinutes: 35, points: 40 },
  { id: `${prefix}-b`, title: "Applied problems", questionType: "Worked problems", questionCount: 3, durationMinutes: 55, points: 60 },
];
const catalog = [
  ["Algorithms & Data Structures", "CS-301", ["Midterm practice", "Final 2026", "Graph theory retake"]],
  ["Machine Learning", "DS-410", ["Neural networks quiz", "ML final", "Model evaluation lab"]],
  ["Quantum Physics", "PHY-401", ["Quantum midterm", "Final exam 2026", "Problem set review"]],
  ["Academic English", "ENG-202", ["Writing assessment", "Speaking mock", "Research methods final"]],
];

async function seedArtifact(token, exam, filename, mediaType, content) {
  const page = await request(`/exams/${exam.id}/artifacts`, {}, token);
  if (page.items.some((item) => item.original_name === filename)) return false;
  const upload = await request(`/exams/${exam.id}/artifacts/uploads`, {
    method: "POST",
    body: JSON.stringify({ filename, kind: "notes", media_type: mediaType, size_bytes: content.length }),
  }, token);
  const stored = await fetch(upload.upload.url, { method: "PUT", headers: upload.upload.headers, body: content });
  if (!stored.ok) throw new Error(`Object upload failed for ${filename}: ${stored.status}`);
  await request(`/artifacts/${upload.artifact.id}/complete`, { method: "POST" }, token);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const artifact = await request(`/artifacts/${upload.artifact.id}`, {}, token);
    if (["ready", "failed"].includes(artifact.processing_status)) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${filename} did not reach a terminal processing state.`);
}

const token = await loginOrRegister();
const existing = await request("/subjects?limit=100", {}, token);
const alreadySeeded = existing.items.some((item) => item.title === catalog[0][0]);
let totals = { subjects: 0, exams: 0, classes: 0, mocks: 0, attempts: 0, artifacts: 0 };
const allExams = [];
for (const [title, code, examTitles] of alreadySeeded ? [] : catalog) {
  const subject = await request("/subjects", { method: "POST", body: JSON.stringify({ title, university: "TU Wien", course_code: code, visibility: "private" }) }, token);
  totals.subjects += 1;
  const exams = [];
  for (const [index, examTitle] of examTitles.entries()) {
    const exam = await request(`/subjects/${subject.id}/exams`, { method: "POST", body: JSON.stringify({ title: examTitle, description: `${title} preparation workspace with realistic constraints and review notes.`, exam_type: index === 2 ? "Oral assessment" : "Written final", language: "en", pasted_context: "Use official terminology, show reasoning, and prioritise recurring topics.", blueprint: blueprint(`${code}-${index}`, index + 4), rules: { durationMinutes: 90, totalPoints: 100, passPercentage: 50, penalty: "No negative marking", allowedMaterials: "One handwritten A4 sheet", gradingNotes: "Award method points for correct intermediate reasoning." }, scenario: { mode: index === 1 ? "adaptive" : "full_exam", difficulty: index === 2 ? "harder" : "matched", instructions: "Mirror the course structure and make feedback concrete." } }) }, token);
    exams.push(exam); totals.exams += 1;
    allExams.push(exam);
    if (index < 2) {
      const mock = await request(`/exams/${exam.id}/mocks`, { method: "POST" }, token);
      totals.mocks += 1;
      const attempt = await request(`/mocks/${mock.id}/attempts`, { method: "POST" }, token);
      totals.attempts += 1;
      if (index === 0) await request(`/attempts/${attempt.id}/submit`, { method: "POST" }, token);
    }
  }
  await request(`/subjects/${subject.id}/classes`, { method: "POST", body: JSON.stringify({ name: `${title} weekly review`, description: "A focused study group with current exam checkpoints.", exam_scope: "subject", exam_ids: [] }) }, token);
  await request(`/subjects/${subject.id}/classes`, { method: "POST", body: JSON.stringify({ name: `${code} final sprint`, description: "Selected-exam group for the final preparation week.", exam_scope: "selected_exams", exam_ids: exams.slice(0, 2).map((exam) => exam.id) }) }, token);
  totals.classes += 2;
}
if (alreadySeeded) {
  for (const subject of existing.items.filter((item) => catalog.some(([title]) => title === item.title))) {
    const page = await request(`/subjects/${subject.id}/exams?limit=100`, {}, token);
    allExams.push(...page.items);
  }
}
const readyContent = new TextEncoder().encode("Official review notes for the seeded ExamTwin workspace. Focus on recurring concepts, show intermediate reasoning, and verify every final answer. ".repeat(35));
if (allExams[0] && await seedArtifact(token, allExams[0], "Seeded review notes.txt", "text/plain", readyContent)) totals.artifacts += 1;
const brokenPdf = new TextEncoder().encode("%PDF-1.7\nThis intentionally corrupted PDF exercises the failed processing state.");
if (allExams[1] && await seedArtifact(token, allExams[1], "Corrupted sample.pdf", "application/pdf", brokenPdf)) totals.artifacts += 1;
console.log(JSON.stringify({ status: alreadySeeded ? "reconciled" : "seeded", credentials, ...totals }));
