import { NextResponse } from "next/server"
import { withUser } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { updateCategorySchema, safeParseBody } from "@/lib/validation"
import { shortCircuitIdempotent, recordIdempotencyKey } from "@/lib/idempotency"

export const PATCH = withUser(PATCH_handler)

async function PATCH_handler(
  userId: string,
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params

  try {
    const replayed = await shortCircuitIdempotent(req, userId)
    if (replayed) return replayed

    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateCategorySchema)
    if ("error" in parsed) return parsed.error

    const { name, type, color, ruleType } = parsed.data

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (type !== undefined) data.type = type
    if (color !== undefined) data.color = color
    if (ruleType !== undefined) data.ruleType = ruleType

    const updated = await prisma.category.update({
      where: { id },
      data,
    })

    await recordIdempotencyKey(req, userId)

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      color: updated.color,
      ruleType: updated.ruleType,
    })
  } catch (error) {
    console.error("Update category error:", error)
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    )
  }
}

export const DELETE = withUser(DELETE_handler)

async function DELETE_handler(
  userId: string,
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params

  try {
    const replayed = await shortCircuitIdempotent(req, userId)
    if (replayed) return replayed

    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.category.delete({ where: { id } })
    await recordIdempotencyKey(req, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete category error:", error)
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    )
  }
}
