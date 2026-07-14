import type { FieldErrors } from "react-hook-form"
import { cn } from "@/lib/utils"

interface FormErrorProps {
  errors: FieldErrors
  name: string
  className?: string
}

export function FormError({ errors, name, className }: FormErrorProps) {
  const error = errors[name]
  if (!error?.message) return null

  return (
    <p
      role="alert"
      className={cn(
        "text-xs text-red-500 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 ease-out",
        className,
      )}
    >
      {error.message as string}
    </p>
  )
}
