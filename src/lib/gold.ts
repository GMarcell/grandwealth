/**
 * Gold portfolio accounting — single source of truth.
 *
 * Every screen that values the user's gold (gold page, dashboard, net-worth
 * history, AI analysis) must use the same convention so figures never drift
 * apart:
 *
 *   - BUY  adds the purchased weight and adds the buy amount to the cost basis
 *   - SELL removes the sold weight and removes an average-cost share of the
 *         cost basis (avg cost per gram × sold grams)
 *
 * "Total invested" is therefore the *cost basis of the gold currently held*,
 * not the gross amount ever bought. Selling gold held at a profit reduces the
 * cost basis by purchase cost (not by the sale proceeds), so unrealized P&L
 * and the average price per gram stay meaningful.
 *
 * An oversold position (more sold than held — an invalid state that the API
 * currently permits) is clamped to an empty portfolio so downstream math never
 * shows negative weight or a negative cost basis.
 */

export interface GoldEntry {
  type: "BUY" | "SELL"
  weightGram: number
  totalAmount: number
}

export interface GoldPortfolio {
  /** Total grams currently held (0 when nothing is held). */
  totalWeight: number
  /** Cost basis (IDR) of the gold currently held. */
  totalInvested: number
  /** Cost basis per gram (IDR); 0 when no weight is held. */
  avgPricePerGram: number
}

export function computeGoldPortfolio(deposits: GoldEntry[]): GoldPortfolio {
  let totalWeight = 0
  let totalInvested = 0

  for (const d of deposits) {
    if (d.type === "BUY") {
      totalWeight += d.weightGram
      totalInvested += d.totalAmount
    } else {
      const avgCost = totalWeight > 0 ? totalInvested / totalWeight : 0
      const soldWeight = Math.min(d.weightGram, totalWeight)
      totalWeight -= soldWeight
      totalInvested -= avgCost * soldWeight
      if (totalWeight <= 0) {
        totalWeight = 0
        totalInvested = 0
      }
    }
  }

  // Guard against floating-point residue (e.g. 4.999999999 or -1e-12).
  if (totalWeight < 1e-9) {
    totalWeight = 0
    totalInvested = 0
  }
  if (totalInvested < 1e-9) totalInvested = 0

  const avgPricePerGram = totalWeight > 0 ? totalInvested / totalWeight : 0

  return { totalWeight, totalInvested, avgPricePerGram }
}

/** Net signed weight: BUY adds, SELL subtracts. No clamping. */
function signedWeight(deposits: GoldEntry[]): number {
  let weight = 0
  for (const d of deposits) {
    weight += d.type === "BUY" ? d.weightGram : -d.weightGram
  }
  return weight
}

export interface GoldChangeValidation {
  /** Whether the change is allowed. */
  allowed: boolean
  /** Net weight held before the change (never negative). For error messages. */
  heldWeight: number
}

/**
 * Validate a gold-record change (create or update) against overselling.
 *
 * A change is rejected only when it leaves the net position NEGATIVE and makes
 * it worse than before the change:
 *   - selling more than you hold (or selling at all from a zero/negative
 *     position) is blocked with a clear error;
 *   - buying, selling exactly down to zero, and edits that repair an existing
 *     negative position (legacy oversell) remain allowed.
 */
export function validateGoldChange(
  before: GoldEntry[],
  after: GoldEntry[],
): GoldChangeValidation {
  const beforeWeight = signedWeight(before)
  const afterWeight = signedWeight(after)

  const makesOversellWorse =
    afterWeight < -1e-9 && afterWeight < beforeWeight - 1e-9

  return {
    allowed: !makesOversellWorse,
    heldWeight: Math.max(0, beforeWeight),
  }
}
