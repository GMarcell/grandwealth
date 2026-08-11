/**
 * Minimal transactional email helper.
 *
 * Uses Resend (https://resend.com) when RESEND_API_KEY is configured.
 * Without an API key the email is printed to the server console so the
 * password-reset flow can be exercised during local development.
 */

export interface EmailMessage {
  to: string
  subject: string
  html: string
}

export interface SendEmailResult {
  sent: boolean
  provider: "resend" | "dev-log"
}

export async function sendEmail(
  message: EmailMessage,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            process.env.EMAIL_FROM ??
            "GrandWealth <onboarding@resend.dev>",
          to: [message.to],
          subject: message.subject,
          html: message.html,
        }),
      })

      if (!res.ok) {
        console.error("Resend email error:", res.status, await res.text())
        return { sent: false, provider: "resend" }
      }

      return { sent: true, provider: "resend" }
    } catch (error) {
      console.error("Resend email error:", error)
      return { sent: false, provider: "resend" }
    }
  }

  // Development fallback — surface the email in the server log.
  console.log("\n[GrandWealth email dev-mode]")
  console.log(`To: ${message.to}`)
  console.log(`Subject: ${message.subject}`)
  console.log(message.html)
  console.log("")

  return { sent: false, provider: "dev-log" }
}
