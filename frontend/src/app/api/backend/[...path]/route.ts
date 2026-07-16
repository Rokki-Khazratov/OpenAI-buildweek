import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api/config";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { apiRequest, type TokenPair } from "@/lib/auth/upstream";
import { clearSessionCookies, setSessionCookies } from "@/lib/auth/session";

type RouteContext = { params: Promise<{ path: string[] }> };

async function refreshSession(refreshToken: string): Promise<TokenPair | null> {
  const response = await apiRequest("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  return (await response.json()) as TokenPair;
}

function toClientResponse(upstream: Response) {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const requestId = upstream.headers.get("x-request-id");
  if (contentType) headers.set("content-type", contentType);
  if (requestId) headers.set("x-request-id", requestId);
  headers.set("cache-control", "no-store");
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  let rotatedTokens: TokenPair | null = null;

  if (!accessToken && refreshToken) {
    rotatedTokens = await refreshSession(refreshToken);
    accessToken = rotatedTokens?.access_token;
  }

  if (!accessToken) {
    const response = NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const upstreamUrl = new URL(`${apiBaseUrl}/${path.map(encodeURIComponent).join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));
  const requestBody = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const upstreamHeaders = new Headers({ Accept: "application/json", Authorization: `Bearer ${accessToken}` });
  const contentType = request.headers.get("content-type");
  const idempotencyKey = request.headers.get("idempotency-key");
  if (contentType) upstreamHeaders.set("content-type", contentType);
  if (idempotencyKey) upstreamHeaders.set("idempotency-key", idempotencyKey);

  const callUpstream = (token: string) => {
    const headers = new Headers(upstreamHeaders);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: requestBody,
      cache: "no-store",
    });
  };

  let upstream = await callUpstream(accessToken);
  if (upstream.status === 401 && refreshToken && !rotatedTokens) {
    rotatedTokens = await refreshSession(refreshToken);
    if (rotatedTokens) upstream = await callUpstream(rotatedTokens.access_token);
  }

  if (upstream.status === 401) {
    const response = NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const response = toClientResponse(upstream);
  if (rotatedTokens) setSessionCookies(response, rotatedTokens);
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
