import type { ReactNode } from "react"

function renderInlineMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g)

  return parts.map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) ||
        (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-muted px-1 py-0.5 text-xs">{part.slice(1, -1)}</code>
    }
    return (
      <span key={index}>
        {part.split(/<br\s*\/?>/gi).map((line, lineIndex, lines) => (
          <span key={lineIndex}>{line}{lineIndex < lines.length - 1 && <br />}</span>
        ))}
      </span>
    )
  })
}

function renderTableRow(line: string, index: number) {
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|")
  return (
    <div key={index} className="grid grid-cols-[minmax(9rem,0.8fr)_minmax(0,1.8fr)] border-b last:border-b-0">
      {cells.map((cell, cellIndex) => (
        <div key={cellIndex} className={`px-3 py-2 text-sm ${cellIndex === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
          {renderInlineMarkdown(cell.trim())}
        </div>
      ))}
    </div>
  )
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {content.split("\n").map((line, i) => {
        if (/^\s*\|.*\|\s*$/.test(line)) {
          if (/^\s*\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line)) return null
          return renderTableRow(line, i)
        }
        if (/^\s*>\s?/.test(line)) {
          return <div key={i} className="my-3 rounded-lg border-l-4 border-purple-400 bg-purple-50 px-4 py-3 text-sm text-purple-900 dark:bg-purple-950/30 dark:text-purple-200">{renderInlineMarkdown(line.replace(/^\s*>\s?/, ""))}</div>
        }
        if (/^\s*([-*_])\s*\1\s*\1/.test(line)) return <hr key={i} className="my-5 border-border" />
        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-4 mb-1 text-foreground">{renderInlineMarkdown(line.replace(/^### /, ""))}</h3>
        if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold mt-6 mb-2 text-foreground">{renderInlineMarkdown(line.replace(/^## /, ""))}</h2>
        if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-6 mb-3 text-foreground">{renderInlineMarkdown(line.replace(/^# /, ""))}</h1>
        if (/^\s*[-*+]\s+/.test(line)) return <li key={i} className="ml-4 text-sm text-muted-foreground list-disc">{renderInlineMarkdown(line.replace(/^\s*[-*+]\s+/, ""))}</li>
        if (/^\s*\d+[.)]\s+/.test(line)) return <li key={i} className="ml-4 text-sm text-muted-foreground list-decimal">{renderInlineMarkdown(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>
        if (line.trim() === "") return <div key={i} className="h-2" />
        return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{renderInlineMarkdown(line)}</p>
      })}
    </div>
  )
}
