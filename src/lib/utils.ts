import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompactIDR(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `Rp${(value / 1_000_000_000_000).toFixed(2)}T`
  }
  if (value >= 1_000_000_000) {
    return `Rp${(value / 1_000_000_000).toFixed(2)}M`
  }
  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toFixed(2)}jt`
  }
  if (value >= 1_000) {
    return `Rp${(value / 1_000).toFixed(0)}rb`
  }
  return `Rp${value.toFixed(0)}`
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof Error) return error.message
  return fallback
}

// ─── Pagination ────────────────────────────────

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

/**
 * Parse pagination query parameters from a URL.
 * Returns undefined if no page param is present (caller should use legacy array format).
 * Returns default values if params are invalid.
 */
export function parsePagination(url: string | URL, defaultSize = DEFAULT_PAGE_SIZE): PaginationParams | undefined {
  const searchParams = typeof url === "string" ? new URL(url, "http://localhost").searchParams : url.searchParams
  if (!searchParams.has("page")) return undefined
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("pageSize") ?? String(defaultSize), 10) || defaultSize))
  return { page, pageSize }
}

/**
 * Build pagination metadata from a total count and current pagination params.
 */
export function buildPagination(total: number, params: PaginationParams): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize))
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
    hasMore: params.page < totalPages,
  }
}

/**
 * Create a paginated response object with data and metadata.
 */
export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams): PaginatedResponse<T> {
  return {
    data,
    pagination: buildPagination(total, params),
  }
}
