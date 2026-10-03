import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createWidgetToken } from "@/lib/widget-token"

/** List the user's widget tokens (never returns the plaintext). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tokens = await prisma.widgetToken.findMany({
    where: { userId: session.user.id },
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
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const label =
    typeof body?.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 40)
      : "Widget"

  const { token, id, prefix } = await createWidgetToken(session.user.id, label)

  return NextResponse.json({ id, token, prefix, label }, { status: 201 })
}

/** Revoke a token by id. */
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing token id" }, { status: 400 })
  }

  const existing = await prisma.widgetToken.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.widgetToken.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
