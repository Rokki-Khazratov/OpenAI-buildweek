import { NextResponse } from "next/server";

import { apiRequest, readApiError, type TokenPair } from "@/lib/auth/upstream";
import { setSessionCookies } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const form = new URLSearchParams({ username: body.email ?? "", password: body.password ?? "" });
  const upstream = await apiRequest("/auth/login", {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: await readApiError(upstream, "Unable to sign in") }, { status: upstream.status });
  }
  const tokens = (await upstream.json()) as TokenPair;
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  setSessionCookies(response, tokens);
  return response;
}
