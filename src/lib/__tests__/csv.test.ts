import { describe, expect, it } from "vitest"
import { escapeCsvField, parseCsv, parseCsvRow } from "@/lib/csv"

describe("CSV helpers", () => {
  it("round-trips commas and quotes in fields", () => {
    const row = ["EXPENSE", "FOOD", 12500, 'Lunch, "client meeting"', "2026-09-18"]
      .map(escapeCsvField)
      .join(",")

    expect(parseCsvRow(row)).toEqual([
      "EXPENSE",
      "FOOD",
      "12500",
      'Lunch, "client meeting"',
      "2026-09-18",
    ])
  })

  it("parses a document into rows", () => {
    expect(parseCsv('type,description\nINCOME,"Salary, September"')).toEqual([
      ["type", "description"],
      ["INCOME", "Salary, September"],
    ])
  })

  it("rejects unclosed quoted fields", () => {
    expect(() => parseCsvRow('INCOME,"broken')).toThrow("Unclosed quoted CSV field")
  })
})
