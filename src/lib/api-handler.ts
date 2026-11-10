import { NextResponse, type NextRequest } from "next/server"
import * as apiAccess from "@/lib/api-access"

/**
 * Route-handler wrappers that apply an access guard.
 *
 * Every guarded route used to open with the same two lines:
 *
 *     const userId = await requireUser()
 *     if (userId instanceof NextResponse) return userId
 *
 * `withUser` (and its Pro/Admin variants) does that once, so a handler can
 * declare the `userId` it needs as a normal parameter and never see the
 * "authorized or 401 response" union. The guard is resolved through
 * `apiAccess[...]` at call time rather than captured at import time, so tests
 * that mock `@/lib/api-access` keep working.
 */

type GuardName =
  | "requireUser"
  | "requireProUser"
  | "requireAdminUser"
  | "requireAdminOrProPlusUser"

/**
 * @param userId  The authenticated user, already checked by the guard.
 * @param request The incoming request.
 * @param context Next's route context (e.g. `{ params }`); omit when unused.
 */
type GuardedHandler<Ctx> = (
  userId: string,
  request: NextRequest,
  context: Ctx
) => Promise<Response>

function guard<Ctx>(guardName: GuardName, handler: GuardedHandler<Ctx>) {
  // Both parameters are optional so a handler can still be called directly with
  // no arguments (as the route tests do) and Next can pass its own context.
  return async (request?: Request, context?: Ctx): Promise<Response> => {
    const userId = await apiAccess[guardName]()
    if (userId instanceof NextResponse) return userId
    return handler(userId, request as NextRequest, context as Ctx)
  }
}

/** Require a signed-in, non-suspended account. */
export function withUser<Ctx = Record<string, unknown>>(
  handler: GuardedHandler<Ctx>
) {
  return guard("requireUser", handler)
}

/** Require a signed-in account with an active Pro (or better) plan. */
export function withProUser<Ctx = Record<string, unknown>>(
  handler: GuardedHandler<Ctx>
) {
  return guard("requireProUser", handler)
}

/** Require a signed-in administrator. */
export function withAdminUser<Ctx = Record<string, unknown>>(
  handler: GuardedHandler<Ctx>
) {
  return guard("requireAdminUser", handler)
}

/** Require an administrator, or a Pro+ subscriber (the AI endpoints). */
export function withAdminOrProPlusUser<Ctx = Record<string, unknown>>(
  handler: GuardedHandler<Ctx>
) {
  return guard("requireAdminOrProPlusUser", handler)
}
