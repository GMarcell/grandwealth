"use client"

import { useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PaginationMeta } from "@/lib/utils"

interface PaginationProps {
  pagination: PaginationMeta
  page: number
  onPageChange: (page: number) => void
}

/**
 * Generate the range of page numbers to display, with ellipsis markers.
 * Always shows first page, last page, and pages around the current page.
 * Returns (number | "...")[] where "..." represents an ellipsis.
 */
export function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | "...")[] = []

  // Always include first page
  pages.push(1)

  if (current > 3) {
    pages.push("...")
  }

  // Pages around current
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) {
    pages.push("...")
  }

  // Always include last page
  if (total > 1) {
    pages.push(total)
  }

  return pages
}

export function Pagination({ pagination, page, onPageChange }: PaginationProps) {
  const { totalPages, total } = pagination
  const navRef = useRef<HTMLElement>(null)
  const liveRegionRef = useRef<HTMLDivElement>(null)

  // Announce page changes to screen readers via aria-live region
  useEffect(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `Page ${page} of ${totalPages}`
    }
  }, [page, totalPages])

  // Focus the navigation landmark after page changes so keyboard users
  // know where they are. Uses requestAnimationFrame to fire after paint.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      navRef.current?.focus()
    })
    return () => cancelAnimationFrame(raf)
    // Only run when page changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  if (totalPages <= 1) return null

  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <nav
      ref={navRef}
      aria-label="Pagination"
      tabIndex={-1}
      className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      {/* Screen-reader-only live region for announcing page changes */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground order-2 sm:order-1">
          Page {page} of {totalPages}
          <span className="hidden sm:inline">
            {" "}({total.toLocaleString("id-ID")} total)
          </span>
        </p>

        <ul
          role="list"
          className="flex items-center gap-1 order-1 sm:order-2 m-0 p-0 list-none"
        >
          <li>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>

          {pageNumbers.map((item, idx) =>
            item === "..." ? (
              <li key={`ellipsis-${idx}`} aria-hidden="true">
                <span className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground select-none">
                  &hellip;
                </span>
              </li>
            ) : (
              <li key={item}>
                {item === page ? (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center h-8 min-w-8 rounded-lg text-sm font-medium",
                      "bg-primary text-primary-foreground shadow-sm"
                    )}
                    aria-current="page"
                    aria-label={`Page ${item}, current page`}
                  >
                    {item}
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onPageChange(item)}
                    aria-label={`Go to page ${item}`}
                  >
                    {item}
                  </Button>
                )}
              </li>
            )
          )}

          <li>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!pagination.hasMore}
              onClick={() => onPageChange(page + 1)}
              aria-label="Go to next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        </ul>
      </div>
    </nav>
  )
}
