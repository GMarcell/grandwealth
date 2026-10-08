"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, Loader2, X, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type MessageRole = "user" | "assistant"

interface Message {
  role: MessageRole
  content: string
  kind?: "text" | "feature" | "upgrade" | "help" | "prompt"
  suggestions?: string[]
  action?: { label: string; href: string; proOnly?: boolean }
  field?: string
}

const SUGGESTION_MAX = 4

export function Chatbot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      kind: "help",
      content:
        "Hi! I can help you find features in GrandWealth, explain your dashboard, or guide you on where to start. Try asking about budgets, gold, stocks, reports, or \"help\".",
      suggestions: [
        "What features are available?",
        "How do I add a transaction?",
        "What is Pro?",
        "Help me get started",
      ],
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    fetch("/api/user/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setIsPro(data?.isPro === true))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [messages, loading])

  async function sendMessage(
    event: React.FormEvent<HTMLFormElement> | undefined,
  ) {
    if (event) event.preventDefault()
    const content = input.trim()
    if (!content || loading) return

    const userMessage: Message = { role: "user", content }
    const next = [...messages, userMessage]
    setMessages(next)
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Chat failed")
      }
      const assistant: Message = {
        role: "assistant",
        content: result.message,
        kind: result.kind,
        suggestions: result.suggestions,
        action: result.action,
        field: result.field,
      }
      setMessages([...next, assistant])
    } catch (error) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            error instanceof Error ? error.message : "I couldn't respond right now.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSuggestionClick(text: string) {
    setInput(text)
    formRef.current?.requestSubmit()
  }

  function handleQuickAction(href: string) {
    window.location.href = href
    setOpen(false)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-[min(28rem,calc(100vw-2.5rem))] flex flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Bot className="h-4 w-4 text-primary" />
              <span>GrandWealth Assistant</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label="Close chatbot"
              className="h-7 w-7"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-3 scroll-smooth"
          >
            {messages.map((message, index) => (
              <ChatMessage
                key={`${message.role}-${index}`}
                message={message}
                onSuggestionClick={handleSuggestionClick}
                onActionClick={handleQuickAction}
              />
            ))}
            {loading && (
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Typing...</span>
              </div>
            )}
          </div>

          {/* Quick actions strip */}
          {messages.length === 1 && (
            <div className="border-t px-3 py-2">
              <div className="flex flex-wrap gap-1.5">
                <QuickActionChip
                  label="Add transaction"
                  href="/transactions?add=1"
                  onClick={handleQuickAction}
                />
                {isPro && (
                  <>
                    <QuickActionChip
                      label="Record gold"
                      href="/gold?add=1"
                      onClick={handleQuickAction}
                    />
                    <QuickActionChip
                      label="Add savings"
                      href="/savings?add=1"
                      onClick={handleQuickAction}
                    />
                    <QuickActionChip
                      label="Add stock"
                      href="/stocks?add=1"
                      onClick={handleQuickAction}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            ref={formRef}
            onSubmit={(event) => sendMessage(event)}
            className="flex gap-2 border-t p-3"
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about GrandWealth..."
              aria-label="Chat message"
              className="text-sm"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 h-[34px]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <Button
        onClick={() => setOpen((value) => !value)}
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        aria-label={open ? "Close chatbot" : "Open chatbot"}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </Button>
    </div>
  )
}

function ChatMessage({
  message,
  onSuggestionClick,
  onActionClick,
}: {
  message: Message
  onSuggestionClick: (text: string) => void
  onActionClick: (href: string) => void
}) {
  if (message.role === "user") {
    return (
      <div className="max-w-[88%] ml-auto rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm">
        <MarkdownLine text={message.content} />
      </div>
    )
  }

  return (
    <div className="max-w-[88%] rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-sm shadow-sm">
      <MarkdownLine text={message.content} />

      {/* Feature / upgrade action card */}
      {message.action && (
        <div className="mt-2 flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-2">
          {message.action.proOnly && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Pro
            </Badge>
          )}
          <Link
            href={message.action.href}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted",
              message.action.proOnly && "text-primary",
            )}
            onClick={() => onActionClick(message.action!.href)}
          >
            {message.action.label}
            <span className="ml-1 text-[10px] opacity-70">→</span>
          </Link>
        </div>
      )}

      {/* Prompt field */}
      {message.kind === "prompt" && message.field && (
        <div className="mt-2">
          <p className="text-[11px] text-muted-foreground mb-1">
            {message.field === "type"
              ? "Income or expense?"
              : message.field === "amount"
              ? "Amount (e.g. 10000 or -5000)"
              : message.field === "category"
              ? "Category name"
              : message.field === "notes"
              ? "Note (optional)"
              : ""}
          </p>
          <div className="flex gap-1.5">
            <Input
              value={""}
              readOnly
              aria-label={`Waiting for ${message.field} reply`}
              className="flex-1 bg-muted/50"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSuggestionClick("skip")}
            >
              Skip
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Reply in the chat with your answer — the bot will continue from there.
          </p>
        </div>
      )}

      {/* Suggestion chips */}
      {message.suggestions && message.suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {message.suggestions.slice(0, SUGGESTION_MAX).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestionClick(suggestion)}
              className="rounded-md border border-border/60 bg-background/60 px-2 py-1 text-xs transition-colors hover:bg-muted hover:border-primary/40"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Render a message line with minimal inline markdown:
 * - **[bold](url)** becomes a Link
 * - `**bold**` becomes bold text
 * - backtick code spans become monospace
 */
function MarkdownLine({ text }: { text: string }) {
  if (!text) return null

  // Split on **[link text](url)** first (must be before plain ** handling)
  const withLinks = text.split(/(\*\*.*?\([^)]+\)\*\*)/g).map((chunk) => {
    const linkMatch = chunk.match(/\*\*(.*?)\(([^)]+)\)\*\*/)
    if (linkMatch) {
      return (
        <Link
          key={chunk}
          href={linkMatch[2]}
          className="font-medium underline underline-offset-2 hover:no-underline text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {linkMatch[1]}
        </Link>
      )
    }
    return chunk
  })

  // Then handle **bold**, `code`, and plain text
  const segments = withLinks.flatMap((chunk) => {
    if (typeof chunk !== "string") return chunk
    if (!chunk) return []

    const parts: React.ReactNode[] = []
    let remaining = chunk

    while (remaining) {
      // code span
      const codeIdx = remaining.indexOf("`")
      if (codeIdx !== -1) {
        if (codeIdx > 0) parts.push(remaining.slice(0, codeIdx))
        const closeIdx = remaining.indexOf("`", codeIdx + 1)
        if (closeIdx !== -1) {
          parts.push(
            <code
              key={`code-${parts.length}`}
              className="rounded bg-muted/60 px-1 font-mono text-[11px]"
            >
              {remaining.slice(codeIdx + 1, closeIdx)}
            </code>,
          )
          remaining = remaining.slice(closeIdx + 1)
        } else {
          parts.push(remaining)
          remaining = ""
        }
        continue
      }

      // bold
      const boldIdx = remaining.indexOf("**")
      if (boldIdx !== -1) {
        if (boldIdx > 0) parts.push(remaining.slice(0, boldIdx))
        const closeIdx = remaining.indexOf("**", boldIdx + 2)
        if (closeIdx !== -1) {
          parts.push(
            <strong key={`b-${parts.length}`} className="font-medium">
              {remaining.slice(boldIdx + 2, closeIdx)}
            </strong>,
          )
          remaining = remaining.slice(closeIdx + 2)
        } else {
          parts.push(remaining)
          remaining = ""
        }
        continue
      }

      parts.push(remaining)
      remaining = ""
    }

    return parts
  })

  return <>{segments}</>
}

function QuickActionChip({
  label,
  href,
  onClick,
}: {
  label: string
  href: string
  onClick: (href: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(href)}
      className="rounded-md border border-border/60 bg-background/60 px-2 py-1 text-center text-xs transition-colors hover:bg-muted hover:text-primary"
    >
      {label}
    </button>
  )
}
