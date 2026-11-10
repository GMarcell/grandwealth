import { NextResponse } from "next/server"
import { withUser } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { createWidgetToken } from "@/lib/widget-token"

/** List the user's widget tokens (never returns the plaintext). */
export const GET = withUser(GET_handler)

async function GET_handler(userId: string) {

  const tokens = await prisma.widgetToken.findMany({
    where: { userId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      prefix: true,
      label: true,
      lastUsedAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ tokens })
}

/** Create a new widget token. The plaintext is returned ONCE here. */
export const POST = withUser(POST_handler)

async function POST_handler(userId: string, req: Request) {

  const body = await req.json().catch(() => ({}))
  const label =
    typeof body?.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 40)
      : "Widget"

  const { token, id, prefix } = await createWidgetToken(userId, label)

  return NextResponse.json({ id, token, prefix, label }, { status: 201 })
}

/** Revoke a token by id. */
export const DELETE = withUser(DELETE_handler)

async function DELETE_handler(userId: string, req: Request) {

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing token id" }, { status: 400 })
  }

  const existing = await prisma.widgetToken.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.widgetToken.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
