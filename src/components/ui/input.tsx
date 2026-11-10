import * as React from "react"
import { cn } from "@/lib/utils"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Group thousands in the displayed value ("1000000" → "1.000.000").
   *
   * `"period"` uses the Indonesian convention. The value reported through
   * `onChange` stays a plain digit string, so number schemas and `parseFloat`
   * keep working unchanged. A value that is not a whole number (e.g. the
   * fractional `1500.75` a CSV import can store) is left exactly as it is —
   * its dot is a decimal separator, not a thousands separator.
   */
  delimiters?: "period"
}

/** Insert a separator every three digits. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, delimiters, onChange, onFocus, onBlur, ...props }, ref) => {
    const groupsThousands = delimiters === "period"

    /**
     * Hand a handler an event that reports the unformatted digits.
     *
     * react-hook-form reads `event.target.value`, and controlled callers read
     * it too, so both are handed plain digits — the component re-renders (or
     * leaves in the DOM) the grouped text itself.
     *
     * The target omits `type` on purpose: react-hook-form reads the live DOM
     * node (`ref.value`, i.e. the grouped text) whenever `target.type` exists,
     * and only falls back to `event.target.value` when it does not.
     */
    function digitsEvent<T extends React.SyntheticEvent<HTMLInputElement>>(
      event: T,
      digits: string,
    ): T {
      const input = event.target as HTMLInputElement
      return {
        ...event,
        target: Object.assign({}, input, { value: digits, name: input.name }),
      } as unknown as T
    }

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      const input = event.target
      const digits = input.value.replace(/\D/g, "")
      const caretWasAtEnd = input.selectionStart === input.value.length

      input.value = groupThousands(digits)
      // Grouping shifts every position after the first separator; keep the
      // caret at the end instead of letting it jump backwards mid-typing.
      if (caretWasAtEnd) {
        input.setSelectionRange(input.value.length, input.value.length)
      }

      onChange?.(digitsEvent(event, digits))
    }

    function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
      const input = event.target
      // Values written programmatically (e.g. react-hook-form's `reset` for the
      // edit dialog) arrive unformatted — group them once the field is touched.
      // Only whole numbers qualify: in a fractional value like "1500.75" (a CSV
      // import can produce one) the dot is a decimal separator, not a thousands
      // separator, so grouping would turn the amount into 150.075.
      if (/^\d+$/.test(input.value)) {
        input.value = groupThousands(input.value)
      }
      onFocus?.(event)
    }

    function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
      // react-hook-form reads the DOM value on blur, which by now holds the
      // grouped text ("1.000.000"). Report the digits instead, or a form would
      // validate and submit that grouped string — `Number("1.000.000")` is NaN.
      // Text that is not exactly this component's grouped form is passed
      // through untouched so a fractional value round-trips unchanged.
      const input = event.target
      const digits = input.value.replace(/\D/g, "")
      onBlur?.(
        groupThousands(digits) === input.value ? digitsEvent(event, digits) : event,
      )
    }

    // A controlled caller keeps the raw digits in state, so the rendered value
    // has to be grouped here for the separator to survive re-renders. Only
    // whole numbers are grouped — see handleFocus for why.
    const value =
      groupsThousands && typeof props.value === "string" && /^\d+$/.test(props.value)
        ? groupThousands(props.value)
        : props.value

    return (
      <input
        {...props}
        value={value}
        type={groupsThousands ? "text" : type}
        inputMode={groupsThousands ? "numeric" : props.inputMode}
        className={cn(
          "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onChange={groupsThousands ? handleChange : onChange}
        onFocus={groupsThousands ? handleFocus : onFocus}
        onBlur={groupsThousands ? handleBlur : onBlur}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
