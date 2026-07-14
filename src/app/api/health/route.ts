import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Health check endpoint.
 *
 * - Returns 200 with service status if the database is reachable.
 * - Returns 503 if the database is unreachable.
 * - Use this for monitoring, load balancer checks, and uptime monitoring (e.g., Better Uptime, Pingdom).
 *
 * Examples:
 *   curl https://yourdomain.com/api/health
 *   curl http://localhost:3000/api/health
 */
export async function GET() {
  try {
    // Lightweight database connectivity check
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: "connected",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Health check failed:", error)

    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: "disconnected",
      },
      { status: 503 }
    )
  }
}
