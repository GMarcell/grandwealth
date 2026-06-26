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
