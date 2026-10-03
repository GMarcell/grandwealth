import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

export const WIDGET_TOKEN_HEADER = "x-widget-token"

const TOKEN_PREFIX = "gw_widget_"

/** SHA-256 hash of a token — the only form persisted. */
export function hashWidgetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Create a widget token for a user. Returns the plaintext token exactly once;
 * only its hash is stored, so it can never be recovered afterwards.
 */
export async function createWidgetToken(
  userId: string,
  label = "Widget",
): Promise<{ token: string; id: string; prefix: string }> {
  const secret = randomBytes(24).toString("base64url")
  const token = `${TOKEN_PREFIX}${secret}`
  const tokenHash = hashWidgetToken(token)
  const prefix = token.slice(0, TOKEN_PREFIX.length + 4)

  const record = await prisma.widgetToken.create({
    data: { userId, tokenHash, prefix, label },
  })

  return { token, id: record.id, prefix }
}

/**
 * Resolve a widget token to its owning user. Returns null for unknown tokens.
 * Records `lastUsedAt` best-effort so Settings can show recent activity.
 */
export async function resolveWidgetToken(
  token: string | null | undefined,
): Promise<{ userId: string } | null> {
  if (!token) return null
  const tokenHash = hashWidgetToken(token)

  const record = await prisma.widgetToken.findUnique({ where: { tokenHash } })
  if (!record) return null

  // Best-effort activity stamp; never block the request on it.
  prisma.widgetToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return { userId: record.userId }
}
