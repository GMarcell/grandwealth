/**
 * GET a JSON API route.
 *
 * Resolves with the parsed body, and throws the server's `error` message on a
 * non-OK response so a React Query `onError` / `error` gets something useful
 * instead of `res.json is not a function` or a bare status code.
 */
export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "Request failed"
    throw new Error(message)
  }

  return body as T
}
