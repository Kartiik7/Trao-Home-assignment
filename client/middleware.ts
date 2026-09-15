import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js edge middleware — route guard.
 *
 * Checks for the `token` cookie to decide whether the user has a session.
 * NOTE: This only checks cookie existence, not JWT validity. Actual JWT
 * verification happens server-side via GET /auth/me. This middleware is
 * a fast redirect gate, not a security boundary.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Unauthenticated user trying to access protected page → redirect to login
  if (!token && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user trying to access auth pages → redirect to home
  if (token && isAuthPage) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /api (API routes)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt, static assets
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$).*)",
  ],
};
