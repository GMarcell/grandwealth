/** Escape one CSV field according to RFC 4180 rules. */
export function escapeCsvField(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Parse a CSV row, honoring quoted fields, escaped quotes, and commas. */
export function parseCsvRow(line: string): string[] {
  const fields: string[] = []
  let field = ""
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === "," && !quoted) {
      fields.push(field)
      field = ""
    } else {
      field += char
    }
  }

  if (quoted) throw new Error("Unclosed quoted CSV field")
  fields.push(field)
  return fields
}

/** Remove thousands separators from an integer part, or null if they are malformed. */
function stripThousands(text: string, separator: string): string | null {
  if (!text.includes(separator)) return /^\d+$/.test(text) ? text : null

  const groups = text.split(separator)
  if (!/^\d{1,3}$/.test(groups[0])) return null
  if (!groups.slice(1).every((group) => /^\d{3}$/.test(group))) return null
  return groups.join("")
}

/**
 * Parse an amount out of an imported CSV cell.
 *
 * Exports group thousands — "1.500.000", the same way the app displays them —
 * and use either the Indonesian ("1.500,75") or the English ("1,500.75")
 * convention for decimals. `parseFloat` stops at the first separator and reads
 * "1.500.000" as 1.5, so the text is split here instead: currency symbols and
 * spaces are dropped, then the separators are interpreted by position.
 *
 * Fractions are rounded to the nearest rupiah because every amount in the app
 * is a whole rupiah. Returns null when the text is not a number.
 */
export function parseCsvAmount(raw: string): number | null {
  // Drops "Rp", currency codes, spaces (including non-breaking ones) and any
  // other decoration, keeping digits and separators.
  const text = raw.replace(/[^\d.,+-]/g, "")
  const negative = text.startsWith("-")
  const body = text.replace(/^[+-]/, "")
  if (!body) return null

  const dot = body.lastIndexOf(".")
  const comma = body.lastIndexOf(",")
  let integerPart: string | null
  let fractionPart = ""

  if (dot !== -1 && comma !== -1) {
    // Both separators present: the later one is the decimal separator and the
    // other one groups thousands, so both conventions parse the same way.
    const decimalSep = dot > comma ? "." : ","
    const cut = body.lastIndexOf(decimalSep)
    fractionPart = body.slice(cut + 1)
    if (!/^\d{1,3}$/.test(fractionPart)) return null
    integerPart = stripThousands(body.slice(0, cut), decimalSep === "." ? "," : ".")
  } else if (dot !== -1 || comma !== -1) {
    const sep = dot !== -1 ? "." : ","
    const cut = body.lastIndexOf(sep)
    const tail = body.slice(cut + 1)
    if (body.indexOf(sep) === cut && /^\d{1,2}$/.test(tail)) {
      // A lone separator with one or two trailing digits is a decimal point
      // ("1500.75"); with three it groups thousands ("1.500").
      integerPart = body.slice(0, cut)
      fractionPart = tail
    } else {
      integerPart = stripThousands(body, sep)
    }
  } else {
    integerPart = /^\d+$/.test(body) ? body : null
  }

  if (integerPart === null || !/^\d+$/.test(integerPart)) return null

  const amount = Number(`${integerPart}.${fractionPart || "0"}`)
  if (!Number.isFinite(amount)) return null
  const rounded = Math.round(amount)
  return negative ? -rounded : rounded
}

/**
 * Sample file for the transactions import: the header the route expects plus
 * one expense and one income row. It is offered for download next to the
 * import button, so it has to stay importable as-is — no comment or blank rows.
 */
export function transactionsImportTemplate(): string {
  const today = new Date().toISOString().split("T")[0]
  return [
    ["type", "category", "amount", "description", "date"],
    ["EXPENSE", "FOOD", "150000", "Lunch with the team", today],
    ["INCOME", "SALARY", "5000000", "Monthly salary", today],
  ]
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\n")
    .concat("\n")
}

/** Parse a CSV document with quoted fields. Newlines inside fields are not supported. */
export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvRow)
}
