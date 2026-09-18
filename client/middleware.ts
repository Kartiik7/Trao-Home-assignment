import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js edge middleware — route guard.
 *
 * IMPORTANT: The auth cookie (`token`) is set by the backend (Render) with
 * `httpOnly: true` and `sameSite: "none"`. It is a CROSS-ORIGIN cookie —
 * Netlify (frontend) and Render (backend) are on different domains.
 *
 * The Next.js Edge Runtime cannot read cross-origin httpOnly cookies via
 * `request.cookies`, so any cookie-based guard here would always see an
 * empty token and redirect every user to /login, even after a successful login.
 *
 * Solution: Remove the cookie gate from middleware entirely. Auth protection
 * is handled at the component/context level by AuthProvider → GET /auth/me.
 * Protected pages that need auth will redirect to /login themselves when
 * /auth/me returns 401.
 */
export function middleware(_request: NextRequest) {
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
