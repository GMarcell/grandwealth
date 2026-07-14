import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

/**
 * Auth proxy — protects dashboard routes from unauthenticated access.
 * Unauthenticated users are redirected to /login.
 */
export const proxy = auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth?.user

  const isOnDashboard =
    nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/transactions") ||
    nextUrl.pathname.startsWith("/recurring") ||
    nextUrl.pathname.startsWith("/reports") ||
    nextUrl.pathname.startsWith("/gold") ||
    nextUrl.pathname.startsWith("/stocks") ||
    nextUrl.pathname.startsWith("/budgets") ||
    nextUrl.pathname.startsWith("/settings")

  if (isOnDashboard && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  /*
   * Match all request paths except:
   * - api/auth (auth API routes)
   * - api/cron (cron job webhooks)
   * - _next/static (static files)
   * - _next/image (image optimization files)
   * - favicon.svg, robots.txt, sitemap.xml (public files)
   * - login, register (public pages)
   * - / (root — handled by redirect)
   */
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon\\.svg|robots\\.txt|sitemap\\.xml|login|register|$).*)",
  ],
}
