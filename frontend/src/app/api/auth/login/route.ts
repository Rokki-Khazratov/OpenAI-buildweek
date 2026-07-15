import { NextResponse } from "next/server";

import { ACCESS_COOKIE, authCookieOptions, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { apiRequest, readApiError, type TokenPair } from "@/lib/auth/upstream";

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
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, {
    ...authCookieOptions,
    maxAge: tokens.expires_in,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
    ...authCookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
