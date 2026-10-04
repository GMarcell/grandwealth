import { describe, it, expect } from "vitest"
import { verifyCronSecret } from "../cron-auth"

const SECRET = "test-cron-secret"

describe("verifyCronSecret", () => {
  it("accepts the exact secret as a Bearer token", () => {
    expect(verifyCronSecret(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it("rejects a missing Authorization header", () => {
    expect(verifyCronSecret(null, SECRET)).toBe(false)
  })

  it("rejects a non-Bearer scheme", () => {
    expect(verifyCronSecret(`Basic ${SECRET}`, SECRET)).toBe(false)
  })

  it("rejects a wrong secret of the same length", () => {
    const wrong = "x".repeat(SECRET.length)
    expect(verifyCronSecret(`Bearer ${wrong}`, SECRET)).toBe(false)
  })

  it("rejects a wrong secret of a different length", () => {
    expect(verifyCronSecret("Bearer short", SECRET)).toBe(false)
  })

  it("rejects an empty token", () => {
    expect(verifyCronSecret("Bearer ", SECRET)).toBe(false)
  })

  it("does not treat a secret with surrounding whitespace as valid", () => {
    expect(verifyCronSecret(`Bearer ${SECRET} `, SECRET)).toBe(false)
  })
})
