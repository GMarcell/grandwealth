import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const categories = await prisma.category.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { name, type, color } = await req.json()

    if (!name || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (!["INCOME", "EXPENSE"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be INCOME or EXPENSE" },
        { status: 400 }
      )
    }

    const existing = await prisma.category.findUnique({
      where: { name_userId: { name, userId: session.user.id } },
    })

    if (existing) {
      return NextResponse.json(
        { error: "You already have a category with that name" },
        { status: 409 }
      )
    }

    const category = await prisma.category.create({
      data: {
        name,
        type,
        color: color || "#6366f1",
        userId: session.user.id,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Create category error:", error)
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    )
  }
}
