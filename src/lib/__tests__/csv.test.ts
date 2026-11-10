import { describe, expect, it } from "vitest"
import {
  escapeCsvField,
  parseCsv,
  parseCsvAmount,
  parseCsvRow,
  transactionsImportTemplate,
} from "@/lib/csv"

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

  it("builds a template the import route accepts", () => {
    const rows = parseCsv(transactionsImportTemplate())

    expect(rows[0]).toEqual(["type", "category", "amount", "description", "date"])
    expect(rows).toHaveLength(3)
    for (const row of rows.slice(1)) {
      expect(row).toHaveLength(5)
      expect(["INCOME", "EXPENSE"]).toContain(row[0])
      expect(parseCsvAmount(row[2])).toBeGreaterThan(0)
    }
  })
})

describe("parseCsvAmount", () => {
  it.each([
    ["1500000", 1500000],
    ["1.500.000", 1500000],
    ["1.500", 1500],
    ["Rp 1.500.000", 1500000],
    ["1 500 000", 1500000],
    ["1\u00a0500\u00a0000", 1500000],
    ["1500.75", 1501],
    ["1.500,75", 1501],
    ["1,500.75", 1501],
    ["1,500", 1500],
    ["1.500,00", 1500],
    ["1.234.567,89", 1234568],
    ["+1500", 1500],
    ["-1500", -1500],
  ])("parses %j as %d", (input, expected) => {
    expect(parseCsvAmount(input)).toBe(expected)
  })

  it.each([[""], ["Rp"], ["abc"], ["1.50.000"], ["1.500.000,1234"], ["1500-"]])(
    "rejects %j",
    (input) => {
      expect(parseCsvAmount(input)).toBeNull()
    },
  )
})
