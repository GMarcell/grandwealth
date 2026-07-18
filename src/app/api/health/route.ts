import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Health check endpoint.
 *
 * - Returns 200 with service status if the database is reachable and env is configured.
 * - Returns 503 if the database is unreachable.
 * - Use this for monitoring, load balancer checks, and uptime monitoring (e.g., Better Uptime, Pingdom).
 *
 * Examples:
 *   curl https://yourdomain.com/api/health
 *   curl http://localhost:3000/api/health
 */
export async function GET() {
  const checks: Record<string, string> = {}
  let allHealthy = true

  // Check 1: Database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = "connected"
  } catch (error) {
    console.error("Health check — database failed:", error)
    checks.database = "disconnected"
    allHealthy = false
  }

  // Check 2: Auth secret configured
  checks.auth = process.env.AUTH_SECRET ? "configured" : "missing"
  if (!process.env.AUTH_SECRET) allHealthy = false

  // Check 3: Cron secret (optional but warn if missing)
  checks.cron = process.env.CRON_SECRET ? "configured" : "not configured (optional)"

  // Check 4: Groq API key (optional)
  checks.groq = process.env.GROQ_API_KEY ? "configured" : "not configured (optional)"

  // Check 5: Database URL exists
  checks.databaseUrl = process.env.DATABASE_URL ? "configured" : "missing"
  if (!process.env.DATABASE_URL) allHealthy = false

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
