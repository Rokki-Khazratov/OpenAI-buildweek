const api = process.env.API_URL ?? "http://localhost:8010/api/v1";
const email = `p1-smoke-${Date.now()}@example.com`;
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
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}

await request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, display_name: "P1 Smoke" }) });
const loginResponse = await fetch(`${api}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ username: email, password }),
});
if (!loginResponse.ok) throw new Error(`Login failed: ${loginResponse.status}`);
const { access_token: token } = await loginResponse.json();
const subject = await request("/subjects", { method: "POST", body: JSON.stringify({ title: "P1 artifact smoke" }) }, token);
const exam = await request(`/subjects/${subject.id}/exams`, { method: "POST", body: JSON.stringify({ title: "Worker ingestion smoke", blueprint: [{ id: "a", title: "Part A", questionType: "Open", questionCount: 1, durationMinutes: 10, points: 10 }] }) }, token);
const content = Buffer.from("Deterministic artifact processing through MinIO, Redis, and Dramatiq. ".repeat(50));
const session = await request(`/exams/${exam.id}/artifacts/uploads`, { method: "POST", body: JSON.stringify({ filename: "smoke.txt", kind: "notes", media_type: "text/plain", size_bytes: content.length }) }, token);
const preflight = await fetch(session.upload.url, {
  method: "OPTIONS",
  headers: {
    Origin: "http://localhost:3000",
    "Access-Control-Request-Method": "PUT",
    "Access-Control-Request-Headers": "content-type",
  },
});
if (preflight.headers.get("access-control-allow-origin") !== "http://localhost:3000") {
  throw new Error(`MinIO CORS preflight failed: ${preflight.status}`);
}
const upload = await fetch(session.upload.url, { method: "PUT", headers: session.upload.headers, body: content });
if (!upload.ok) throw new Error(`MinIO upload failed: ${upload.status} ${await upload.text()}`);
await request(`/artifacts/${session.artifact.id}/complete`, { method: "POST" }, token);

let artifact;
for (let attempt = 0; attempt < 30; attempt += 1) {
  artifact = await request(`/artifacts/${session.artifact.id}`, {}, token);
  if (artifact.processing_status === "ready" || artifact.processing_status === "failed") break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (artifact?.processing_status !== "ready") throw new Error(`Artifact did not become ready: ${JSON.stringify(artifact)}`);
const summary = await request(`/artifacts/${artifact.id}/content-summary`, {}, token);
if (summary.chunk_count < 2 || !summary.preview.includes("Deterministic artifact")) throw new Error(`Unexpected summary: ${JSON.stringify(summary)}`);
await request(`/artifacts/${artifact.id}`, { method: "DELETE" }, token);
console.log(JSON.stringify({ status: "ready", pages: summary.page_count, chunks: summary.chunk_count, characters: summary.character_count }));
