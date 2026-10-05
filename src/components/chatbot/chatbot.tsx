"use client"

import { useEffect, useState } from "react"
import { Bot, Loader2, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Message = { role: "user" | "assistant"; content: string }

export function Chatbot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I can help you understand and use GrandWealth. What would you like to do?" },
  ])

  useEffect(() => {
    fetch("/api/user/subscription")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setIsPro(data?.isPro === true))
      .catch(() => undefined)
  }, [])

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || loading) return
    const next = [...messages, { role: "user" as const, content }]
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
      if (!response.ok) throw new Error(result.error || "Chat failed")
      setMessages([...next, { role: "assistant", content: result.message }])
    } catch (error) {
      setMessages([...next, { role: "assistant", content: error instanceof Error ? error.message : "I couldn't respond right now." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[min(32rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 font-semibold"><Bot className="h-5 w-5 text-primary" /> GrandWealth Assistant</div>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close chatbot"><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
                {message.content}
              </div>
            ))}
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t px-3 pt-3">
            <Link href="/transactions?add=1" className="rounded-md border px-2 py-1.5 text-center text-xs hover:bg-muted">Add transaction</Link>
            {isPro && <>
              <Link href="/gold?add=1" className="rounded-md border px-2 py-1.5 text-center text-xs hover:bg-muted">Record gold</Link>
              <Link href="/savings?add=1" className="rounded-md border px-2 py-1.5 text-center text-xs hover:bg-muted">Add savings</Link>
              <Link href="/stocks?add=1" className="rounded-md border px-2 py-1.5 text-center text-xs hover:bg-muted">Add stock</Link>
            </>}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
            <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about GrandWealth..." aria-label="Chat message" />
            <Button type="submit" disabled={loading || !input.trim()}>Send</Button>
          </form>
        </div>
      )}
      <Button onClick={() => setOpen((value) => !value)} size="icon" className="h-12 w-12 rounded-full shadow-lg" aria-label={open ? "Close chatbot" : "Open chatbot"}>
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Button>
    </div>
  )
}
