import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const ACCESS_COOKIE = "examtwin_access";
export const REFRESH_COOKIE = "examtwin_refresh";

export const authCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  priority: "high",
};
