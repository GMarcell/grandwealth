import { prisma } from "@/lib/prisma"

/**
 * Advance a recurring transaction's next occurrence by its frequency.
 */
export function advanceRecurringDate(
  date: Date,
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY",
): Date {
  const d = new Date(date)
  if (frequency === "WEEKLY") {
    d.setDate(d.getDate() + 7)
  } else if (frequency === "MONTHLY") {
    d.setMonth(d.getMonth() + 1)
  } else {
    d.setFullYear(d.getFullYear() + 1)
  }
  return d
}

export interface ApplyRecurringResult {
  created: number
  deactivated: number
}

/**
 * Materialize every due recurring transaction into a real Transaction record,
 * then advance its nextDate into the future (catching up on missed runs).
 *
 * Schedules whose next occurrence falls past their endDate are deactivated.
 * Errors on a single schedule do not abort the whole batch.
 */
export async function applyDueRecurringTransactions(
  now: Date = new Date(),
): Promise<ApplyRecurringResult> {
  // Recurring automation is a Pro feature — skip schedules whose owner is no
  // longer entitled (free, lapsed, or suspended) so ex-subscribers can't keep
  // materializing transactions.
  const due = await prisma.recurringTransaction.findMany({
    where: {
      active: true,
      nextDate: { lte: now },
      user: {
        plan: "PRO",
        subscriptionStatus: "ACTIVE",
        suspended: false,
        OR: [
          { currentPeriodEnd: null },
          { currentPeriodEnd: { gt: now } },
        ],
      },
    },
  })

  let created = 0
  let deactivated = 0

  for (const recurring of due) {
    try {
      // Each schedule is applied atomically: the transaction creation, the
      // savings-goal credit, and the nextDate/active update all commit (or all
      // roll back) together, so a partial failure can never double-materialize
      // a transaction or double-credit a goal on the next run.
      const result = await prisma.$transaction(async (tx) => {
        let cursor = new Date(recurring.nextDate)
        let createdForThis = 0

        // Materialize every occurrence that is due (backfills missed runs).
        while (cursor <= now) {
          if (recurring.endDate && cursor > recurring.endDate) break

          await tx.transaction.create({
            data: {
              type: recurring.type,
              category: recurring.category,
              amount: recurring.amount,
              description: recurring.description,
              date: cursor,
              userId: recurring.userId,
            },
          })

          // If the schedule is linked to a savings goal, credit the goal with
          // the same amount (e.g. a monthly "savings transfer" item).
          if (recurring.savingsGoalId) {
            await tx.savingsGoal.updateMany({
              where: {
                id: recurring.savingsGoalId,
                userId: recurring.userId,
              },
              data: { savedAmount: { increment: recurring.amount } },
            })
          }

          createdForThis++
          cursor = advanceRecurringDate(cursor, recurring.frequency)
        }

        if (createdForThis === 0) {
          // Next occurrence already falls past the end date — schedule is done.
          await tx.recurringTransaction.update({
            where: { id: recurring.id },
            data: { active: false },
          })
          return { created: 0, deactivated: 1 }
        }

        const finished =
          recurring.endDate != null && cursor > recurring.endDate

        await tx.recurringTransaction.update({
          where: { id: recurring.id },
          data: { nextDate: cursor, active: finished ? false : true },
        })

        return { created: createdForThis, deactivated: finished ? 1 : 0 }
      })

      created += result.created
      deactivated += result.deactivated
    } catch (error) {
      console.error(
        `Failed to apply recurring transaction ${recurring.id}:`,
        error,
      )
    }
  }

  return { created, deactivated }
}
