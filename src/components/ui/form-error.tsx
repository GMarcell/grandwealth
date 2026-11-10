import type { FieldErrors } from "react-hook-form"
import { cn } from "@/lib/utils"

interface FormErrorProps {
  errors: FieldErrors
  name: string
  className?: string
  /**
   * Id for the message. Defaults to `${name}-error`, which is what the form
   * fields reference through `aria-describedby`.
   */
  id?: string
}

/**
 * ARIA attributes that tie a field to the message `FormError` renders for it.
 *
 * Spread onto the field so screen readers announce the error and mark the
 * input invalid:
 *
 *     <Input {...fieldErrorProps(errors, "amount")} />
 *     <FormError errors={errors} name="amount" />
 *
 * Returns nothing while the field is valid, so no stray attributes appear.
 */
export function fieldErrorProps(errors: FieldErrors, name: string) {
  if (!errors[name]?.message) return {}
  return {
    "aria-invalid": true,
    "aria-describedby": `${name}-error`,
  } as const
}

export function FormError({ errors, name, className, id }: FormErrorProps) {
  const error = errors[name]
  if (!error?.message) return null

  return (
    <p
      id={id ?? `${name}-error`}
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
