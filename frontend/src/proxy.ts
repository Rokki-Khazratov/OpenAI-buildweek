import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";

const publicRoutes = new Set(["/", "/login", "/register"]);

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const authenticated = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);
  if (!authenticated && !publicRoutes.has(path)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  if (authenticated && (path === "/login" || path === "/register" || path === "/")) {
    return NextResponse.redirect(new URL("/subjects", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
