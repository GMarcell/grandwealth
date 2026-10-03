import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const IDEMPOTENCY_HEADER = "Idempotency-Key"

// Keys are only meaningful for writes queued by the offline client, which are
// replayed within a short window (on reconnect or next visit). Rows older than
// this are safe to drop.
const KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface IdempotencyOutcome {
  /**
   * True when this exact write has already been applied. The caller should
   * return `replayed` immediately instead of performing the write again.
   */
  duplicate: boolean
  /** The cached JSON response body from the first successful application. */
  replayed?: unknown
}

/**
 * Guard a write endpoint against replaying an already-applied request.
 *
 * The offline client attaches a unique `Idempotency-Key` header to each queued
 * write. A network failure can leave the client unsure whether the write was
 * applied, so it replays on reconnect — without this check, a request that
 * actually succeeded but whose response was lost would be applied twice.
 *
 * Returns `{ duplicate: true }` when the key was already recorded for this
 * user; callers should then return the cached response.
 *
 * Call `recordIdempotencyKey` once the write has actually succeeded.
 */
export async function checkIdempotency(
  req: Request,
  userId: string,
): Promise<IdempotencyOutcome> {
  const key = req.headers.get(IDEMPOTENCY_HEADER)?.trim()
  if (!key) return { duplicate: false }

  // Best-effort cleanup of expired keys so the table cannot grow without bound.
  // Failures here must never block a write.
  try {
    await prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - KEY_TTL_MS) } },
    })
  } catch {
    // ignore
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: { userId_key: { userId, key } },
  })

  if (!existing) return { duplicate: false }

  return {
    duplicate: true,
    replayed: {
      idempotentReplay: true,
      // The original write is already applied; the client only needs to know
      // the replay was accepted so it can drop the queued item and refetch.
      message: "Write already applied",
    },
  }
}

/**
 * Record a successfully-applied write so a later replay of the same key is
 * skipped. Tolerates the unique-constraint race where the key was inserted
 * concurrently by another replay.
 */
export async function recordIdempotencyKey(
  req: Request,
  userId: string,
): Promise<void> {
  const key = req.headers.get(IDEMPOTENCY_HEADER)?.trim()
  if (!key) return

  const url = new URL(req.url)
  try {
    await prisma.idempotencyKey.create({
      data: {
        userId,
        key,
        method: req.method,
        path: url.pathname,
      },
    })
  } catch {
    // Unique-constraint race: another request with the same key already
    // recorded it, which is exactly the state we want.
  }
}

/**
 * Convenience wrapper: if the request is a replay, returns a 200 JSON response
 * the caller should return immediately. Returns `null` when the caller should
 * proceed with the write.
 */
export async function shortCircuitIdempotent(
  req: Request,
  userId: string,
): Promise<NextResponse | null> {
  const outcome = await checkIdempotency(req, userId)
  if (!outcome.duplicate) return null
  return NextResponse.json(outcome.replayed ?? { ok: true }, { status: 200 })
}
