import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "./prisma"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { authConfig } from "./auth.config"
import { rateLimit, getRateLimitKey } from "./rate-limit"
import { isBootstrapAdminEmail } from "./admin-bootstrap"

const nextAuth = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Normalize to lowercase (and trim) so login is case-insensitive and
        // matches the lowercase emails stored by registration.
        const email = (credentials.email as string).trim().toLowerCase()
        const password = credentials.password as string

        // Brute-force protection: NextAuth's Credentials provider has no
        // built-in limiter, so throttle attempts by client IP and per account.
        // Returns null (a generic "invalid credentials" error) when limited.
        if (request) {
          const ipLimit = await rateLimit(`login:${getRateLimitKey(request)}`, {
            limit: 30,
            windowMs: 10 * 60 * 1000,
          })
          if (!ipLimit.allowed) {
            return null
          }
        }

        const accountLimit = await rateLimit(
          `login-account:${email}`,
          {
            limit: 10,
            windowMs: 15 * 60 * 1000,
          }
        )
        if (!accountLimit.allowed) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.password) {
          return null
        }

        const isValid = await compare(password, user.password)

        if (!isValid) {
          return null
        }

        // Suspended accounts can't sign in. Returning null yields the generic
        // "invalid credentials" error so we don't reveal account state.
        if (user.suspended) {
          return null
        }

        // Lazy admin bootstrap: accounts listed in ADMIN_EMAILS are promoted
        // on sign-in so the very first admin can be configured via env var
        // without a script (see src/lib/admin-bootstrap.ts).
        if (user.role !== "ADMIN" && isBootstrapAdminEmail(user.email)) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "ADMIN" },
          })
          user.role = "ADMIN"
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          plan: user.plan,
        }
      },
    }),
  ],
})

export const { handlers, signIn, signOut } = nextAuth

/**
 * API/server authorization must reflect current account state. In particular,
 * a JWT can remain valid after an administrator suspends an account, so do not
 * expose a suspended account through a stale session.
 */
export async function auth() {
  const session = await nextAuth.auth()
  if (!session?.user?.id) return session

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { suspended: true },
  })
  if (!account || account.suspended) return null
  return session
}
