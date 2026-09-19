import type { NextAuthConfig } from "next-auth"
import type { Plan, Role } from "@prisma/client"

export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // Copy role/plan into the token at sign-in. These claims are UI hints
        // only — every authorization check reads the database instead.
        token.role = user.role ?? "USER"
        token.plan = user.plan ?? "FREE"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as Role) ?? "USER"
        session.user.plan = (token.plan as Plan) ?? "FREE"
      }
      return session
    },
  },
}
