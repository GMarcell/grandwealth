"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface ConfirmOptions {
  /** Short question, e.g. "Delete this budget?" */
  title: string
  /** Optional consequence text shown under the title. */
  description?: string
  confirmLabel?: string
  cancelLabel?: string
}

type Pending = ConfirmOptions & { resolve: (confirmed: boolean) => void }

/**
 * The confirmation currently on screen.
 *
 * There is only ever one: a second call replaces the first, whose promise
 * resolves `false`. Keeping it in module scope lets any client component
 * `await confirmDialog(...)` without threading props or a context through.
 */
let pending: Pending | null = null
const listeners = new Set<(next: Pending | null) => void>()

function publish() {
  for (const listener of listeners) listener(pending)
}

function settle(confirmed: boolean) {
  const current = pending
  pending = null
  publish()
  current?.resolve(confirmed)
}

/**
 * Ask the user to confirm a destructive action.
 *
 * Resolves `true` only when they press the confirm button; the Escape key, the
 * overlay, and Cancel all resolve `false`.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false)
  return new Promise<boolean>((resolve) => {
    pending = { ...options, resolve }
    publish()
  })
}

/** Mounts the shared confirmation dialog. Rendered once by `Providers`. */
export function ConfirmDialogHost() {
  const [options, setOptions] = useState<Pending | null>(pending)

  useEffect(() => {
    listeners.add(setOptions)
    // Pick up a confirmation requested before this host mounted.
    setOptions(pending)
    return () => {
      listeners.delete(setOptions)
    }
  }, [])

  return (
    <Dialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{options?.title}</DialogTitle>
          {options?.description && (
            <DialogDescription>{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => settle(false)}>
            {options?.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant="destructive" onClick={() => settle(true)}>
            {options?.confirmLabel ?? "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
