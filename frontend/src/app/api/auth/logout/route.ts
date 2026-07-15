import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { apiRequest } from "@/lib/auth/upstream";

export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await apiRequest("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
      headers: { "Content-Type": "application/json" },
    }).catch(() => undefined);
  }
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  return NextResponse.json({ ok: true });
}
