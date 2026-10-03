import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { OfflineBanner } from "../offline-banner"

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  })
}

describe("OfflineBanner", () => {
  beforeEach(() => {
    setOnline(true)
  })

  afterEach(() => {
    setOnline(true)
  })

  it("renders nothing while online", () => {
    const { container } = render(<OfflineBanner />)
    expect(container.innerHTML).toBe("")
  })

  it("renders the banner while offline", () => {
    setOnline(false)
    render(<OfflineBanner />)
    expect(screen.getByRole("status")).toBeDefined()
    expect(screen.getByText(/You're offline/i)).toBeDefined()
  })

  it("announces politely to screen readers", () => {
    setOnline(false)
    render(<OfflineBanner />)
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite")
  })

  it("appears when the browser goes offline", () => {
    const { container } = render(<OfflineBanner />)
    expect(container.innerHTML).toBe("")

    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event("offline"))
    })

    expect(screen.getByRole("status")).toBeDefined()
  })

  it("disappears when the connection returns", () => {
    setOnline(false)
    const { container } = render(<OfflineBanner />)
    expect(screen.getByRole("status")).toBeDefined()

    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event("online"))
    })

    expect(container.innerHTML).toBe("")
  })
})
