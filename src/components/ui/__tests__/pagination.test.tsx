import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Pagination, getPageNumbers } from "../pagination"
import type { PaginationMeta } from "@/lib/utils"

// ─── getPageNumbers ────────────────────────────

describe("getPageNumbers", () => {
  it("returns all pages when total is 1", () => {
    expect(getPageNumbers(1, 1)).toEqual([1])
  })

  it("returns all pages when total is 7", () => {
    expect(getPageNumbers(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(getPageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(getPageNumbers(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("shows first pages without leading ellipsis", () => {
    const result = getPageNumbers(1, 10)
    expect(result).toEqual([1, 2, "...", 10])
  })

  it("shows page 2 without leading ellipsis, includes 2 and 3", () => {
    const result = getPageNumbers(2, 10)
    expect(result).toEqual([1, 2, 3, "...", 10])
  })

  it("shows page 3 without leading ellipsis, includes 2, 3, and 4", () => {
    const result = getPageNumbers(3, 10)
    expect(result).toEqual([1, 2, 3, 4, "...", 10])
  })

  it("shows middle page with ellipsis on both sides", () => {
    const result = getPageNumbers(5, 10)
    expect(result).toEqual([1, "...", 4, 5, 6, "...", 10])
  })

  it("shows middle page with ellipsis on both sides (page 6 of 10)", () => {
    const result = getPageNumbers(6, 10)
    expect(result).toEqual([1, "...", 5, 6, 7, "...", 10])
  })

  it("shows page near end without trailing ellipsis", () => {
    const result = getPageNumbers(9, 10)
    expect(result).toEqual([1, "...", 8, 9, 10])
  })

  it("shows last page without trailing ellipsis", () => {
    const result = getPageNumbers(10, 10)
    expect(result).toEqual([1, "...", 9, 10])
  })

  it("handles boundary at total=8, current=1", () => {
    const result = getPageNumbers(1, 8)
    expect(result).toEqual([1, 2, "...", 8])
  })

  it("handles boundary at total=8, current=4", () => {
    const result = getPageNumbers(4, 8)
    expect(result).toEqual([1, "...", 3, 4, 5, "...", 8])
  })

  it("handles boundary at total=8, current=8", () => {
    const result = getPageNumbers(8, 8)
    expect(result).toEqual([1, "...", 7, 8])
  })

  it("handles large page counts correctly", () => {
    const result = getPageNumbers(50, 100)
    expect(result[0]).toBe(1)
    expect(result[1]).toBe("...")
    // Last two elements should be ellipsis and the final page
    expect(result.slice(-2)).toEqual(["...", 100])
    // Should contain 49, 50, 51 around the current page
    expect(result).toContain(49)
    expect(result).toContain(50)
    expect(result).toContain(51)
  })

  it("does not include duplicate entries", () => {
    const result = getPageNumbers(1, 10)
    const numberCounts = result.filter((x): x is number => typeof x === "number")
    const uniqueNumbers = new Set(numberCounts)
    expect(uniqueNumbers.size).toBe(numberCounts.length)
  })

  it("always starts with 1 and ends with total", () => {
    for (let current = 1; current <= 20; current++) {
      const result = getPageNumbers(current, 20)
      expect(result[0]).toBe(1)
      expect(result[result.length - 1]).toBe(20)
    }
  })
})

// ─── Pagination component ──────────────────────

function makeMeta(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  return {
    page: 1,
    pageSize: 25,
    total: 100,
    totalPages: 4,
    hasMore: true,
    ...overrides,
  }
}

describe("Pagination component", () => {
  it("returns null when there is only one page", () => {
    const { container } = render(
      <Pagination
        pagination={makeMeta({ totalPages: 1, hasMore: false, total: 5 })}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    expect(container.innerHTML).toBe("")
  })

  it("returns null when there are zero pages", () => {
    const { container } = render(
      <Pagination
        pagination={makeMeta({ totalPages: 0, hasMore: false, total: 0 })}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    expect(container.innerHTML).toBe("")
  })

  it("renders inside a navigation landmark", () => {
    render(
      <Pagination
        pagination={makeMeta()}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(nav).toBeDefined()
  })

  it("renders page info text", () => {
    render(
      <Pagination
        pagination={makeMeta({ page: 2, totalPages: 4, total: 100 })}
        page={2}
        onPageChange={vi.fn()}
      />
    )
    // Both the visible text and the aria-live region contain "Page 2 of 4"
    const matches = screen.getAllByText(/Page 2 of 4/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it("renders an aria-live region for screen reader announcements", () => {
    render(
      <Pagination
        pagination={makeMeta()}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    const liveRegion = screen.getByRole("status")
    expect(liveRegion).toBeDefined()
    expect(liveRegion.getAttribute("aria-live")).toBe("polite")
  })

  it("renders page buttons inside a list", () => {
    render(
      <Pagination
        pagination={makeMeta()}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    const listItems = screen.getAllByRole("listitem")
    // 4 page buttons + 2 nav buttons = 6 list items
    expect(listItems.length).toBeGreaterThanOrEqual(6)
  })

  it("renders Previous and Next buttons", () => {
    render(
      <Pagination
        pagination={makeMeta()}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Go to previous page")).toBeDefined()
    expect(screen.getByLabelText("Go to next page")).toBeDefined()
  })

  it("disables Previous button on the first page", () => {
    render(
      <Pagination
        pagination={makeMeta({ page: 1 })}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Go to previous page").getAttribute("disabled")).not.toBeNull()
  })

  it("disables Next button when hasMore is false", () => {
    render(
      <Pagination
        pagination={makeMeta({ page: 4, totalPages: 4, hasMore: false })}
        page={4}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Go to next page").getAttribute("disabled")).not.toBeNull()
  })

  it("enables Previous button after the first page", () => {
    render(
      <Pagination
        pagination={makeMeta({ page: 2 })}
        page={2}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Go to previous page").getAttribute("disabled")).toBeNull()
  })

  it("enables Next button when there are more pages", () => {
    render(
      <Pagination
        pagination={makeMeta({ page: 2, totalPages: 4, hasMore: true })}
        page={2}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Go to next page").getAttribute("disabled")).toBeNull()
  })

  it("renders page number buttons with descriptive aria-labels", () => {
    render(
      <Pagination
        pagination={makeMeta({ totalPages: 4, total: 40 })}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Go to page 2")).toBeDefined()
    expect(screen.getByLabelText("Go to page 3")).toBeDefined()
    expect(screen.getByLabelText("Go to page 4")).toBeDefined()
  })

  it("renders the active page as a span with aria-current='page'", () => {
    render(
      <Pagination
        pagination={makeMeta({ page: 2, totalPages: 5 })}
        page={2}
        onPageChange={vi.fn()}
      />
    )
    const activePage = screen.getByLabelText("Page 2, current page")
    expect(activePage).toBeDefined()
    expect(activePage.getAttribute("aria-current")).toBe("page")
    // Active page should not be a button (it's a span that isn't interactive)
    expect(activePage.tagName).toBe("SPAN")
  })

  it("does not mark inactive pages with aria-current", () => {
    render(
      <Pagination
        pagination={makeMeta({ page: 1, totalPages: 5 })}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    // Page 1 is the current page, rendered as a span
    // Page 2 and 3 are inactive, rendered as buttons
    const page3Button = screen.getByLabelText("Go to page 3")
    expect(page3Button.getAttribute("aria-current")).toBeNull()
  })

  it("renders ellipsis for large page counts", () => {
    const { container } = render(
      <Pagination
        pagination={makeMeta({ totalPages: 20, total: 500 })}
        page={10}
        onPageChange={vi.fn()}
      />
    )
    // Should render two ellipsis markers (before and after the current page group)
    const ellipsisElements = container.querySelectorAll('[aria-hidden="true"]')
    expect(ellipsisElements.length).toBeGreaterThanOrEqual(2)
  })

  it("calls onPageChange with clicked page number", () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        pagination={makeMeta({ page: 1, totalPages: 5 })}
        page={1}
        onPageChange={onPageChange}
      />
    )
    screen.getByLabelText("Go to page 3").click()
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it("calls onPageChange with page-1 when clicking Previous", () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        pagination={makeMeta({ page: 3, totalPages: 5 })}
        page={3}
        onPageChange={onPageChange}
      />
    )
    screen.getByLabelText("Go to previous page").click()
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("calls onPageChange with page+1 when clicking Next", () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        pagination={makeMeta({ page: 3, totalPages: 5, hasMore: true })}
        page={3}
        onPageChange={onPageChange}
      />
    )
    screen.getByLabelText("Go to next page").click()
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it("renders the total count on large screens", () => {
    render(
      <Pagination
        pagination={makeMeta({ total: 250 })}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByText(/250/)).toBeDefined()
  })

  it("marks icons as aria-hidden for screen readers", () => {
    const { container } = render(
      <Pagination
        pagination={makeMeta()}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    const icons = container.querySelectorAll("svg")
    icons.forEach((icon) => {
      expect(icon.getAttribute("aria-hidden")).toBe("true")
    })
  })

  it("nav element has tabIndex={-1} for programmatic focus management", () => {
    render(
      <Pagination
        pagination={makeMeta()}
        page={1}
        onPageChange={vi.fn()}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(nav.getAttribute("tabindex")).toBe("-1")
  })
})
