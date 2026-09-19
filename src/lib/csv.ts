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

/** Parse a CSV document with quoted fields. Newlines inside fields are not supported. */
export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvRow)
}
