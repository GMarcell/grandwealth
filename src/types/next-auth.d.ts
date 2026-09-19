import type { DefaultSession } from "next-auth"
import type { Plan, Role } from "@prisma/client"

/**
 * Augment NextAuth types with the extra claims GrandWealth stores in the
 * JWT/session (copied from the database at sign-in time).
 *
 * These values are only used for UI hints (nav, badges). Authorization is
 * always re-checked against the database server-side.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: Role
      plan: Plan
    } & DefaultSession["user"]
  }

  interface User {
    role?: Role
    plan?: Plan
    suspended?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: Role
    plan?: Plan
  }
}
