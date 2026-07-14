import { NextResponse } from "next/server";

import { apiRequest, readApiError } from "@/lib/auth/upstream";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; email?: string; password?: string };
  const upstream = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ display_name: body.name, email: body.email, password: body.password }),
    headers: { "Content-Type": "application/json" },
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: await readApiError(upstream, "Unable to create account") }, { status: upstream.status });
  }
  const loginUrl = new URL("/api/auth/login", request.url);
  return fetch(loginUrl, {
    method: "POST",
    body: JSON.stringify({ email: body.email, password: body.password }),
    headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
  });
}
