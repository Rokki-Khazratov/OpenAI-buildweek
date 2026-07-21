import { NextResponse } from "next/server";

import { apiRequest, readApiError, type TokenPair } from "@/lib/auth/upstream";
import { setSessionCookies } from "@/lib/auth/session";

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
  const form = new URLSearchParams({ username: body.email ?? "", password: body.password ?? "" });
  const login = await apiRequest("/auth/login", {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!login.ok) {
    return NextResponse.json(
      { error: await readApiError(login, "Account created, but sign-in failed") },
      { status: login.status },
    );
  }
  const tokens = (await login.json()) as TokenPair;
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  setSessionCookies(response, tokens);
  return response;
}
