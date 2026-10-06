import { NextResponse } from "next/server"
import { requireAdminOrProPlusUser } from "@/lib/api-access"
import { aiGoalPlanSchema, safeParseBody } from "@/lib/validation"
import { generateAiGoalPlanForUser, GoalAiError } from "@/lib/goal-ai"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/goals/ai-plan
 * Body: { goalId: string, deadline?: string, includeSavings?: boolean, includeGold?: boolean, includeSellStocks?: boolean }
 *
 * Pro+ (and admin). Produces an AI (Groq) plan to reach a savings goal by a
 * deadline, grounded in the user's last completed budget month of income and
 * spending. `deadline` is required unless the goal already has a target date.
 * The plan is generated on the fly and is not persisted.
 *
 * Users can optionally include investment options (savings, gold, sell stocks)
 * in their plan, which will show pros and cons for each option based on their
 * actual holdings.
 */
export async function POST(req: Request) {
  // Pro+ exclusive (admins always pass) — this endpoint calls an external,
  // metered AI service.
  const userId = await requireAdminOrProPlusUser()
  if (userId instanceof NextResponse) return userId

  const limiter = await rateLimit(`goal-ai-plan:${userId}`, {
    limit: 5,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    )
  }

  try {
    const parsed = await safeParseBody(req, aiGoalPlanSchema)
    if ("error" in parsed) return parsed.error

    const { goalId, deadline, includeSavings, includeGold, includeSellStocks } = parsed.data
    const plan = await generateAiGoalPlanForUser(
      userId,
      goalId,
      deadline ?? null,
      { includeSavings, includeGold, includeSellStocks },
    )

    return NextResponse.json({ plan })
  } catch (error) {
    if (error instanceof GoalAiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("AI goal plan error:", error)
    return NextResponse.json(
      { error: "Failed to generate AI goal plan" },
      { status: 500 },
    )
  }
}
