import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

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
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login|register).*)",
  ],
}
