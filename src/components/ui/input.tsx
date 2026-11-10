import * as React from "react"
import { cn } from "@/lib/utils"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Group thousands in the displayed value ("1000000" → "1.000.000").
   *
   * `"period"` uses the Indonesian convention. The value reported through
   * `onChange` stays a plain digit string, so number schemas and `parseFloat`
   * keep working unchanged.
   */
  delimiters?: "period"
}

/** Insert a separator every three digits. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, delimiters, onChange, onFocus, ...props }, ref) => {
    const groupsThousands = delimiters === "period"

    /**
     * Report the unformatted digits upwards.
     *
     * react-hook-form reads `event.target.value`, and controlled callers read
     * it too, so both are handed plain digits — the component re-renders (or
     * leaves in the DOM) the grouped text itself.
     */
    function reportDigits(
      event: React.SyntheticEvent<HTMLInputElement>,
      digits: string,
    ) {
      const input = event.target as HTMLInputElement
      onChange?.({
        ...event,
        target: Object.assign({}, input, { value: digits, name: input.name }),
      } as unknown as React.ChangeEvent<HTMLInputElement>)
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

      reportDigits(event, digits)
    }

    function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
      const input = event.target
      const digits = input.value.replace(/\D/g, "")
      // Values written programmatically (e.g. react-hook-form's `reset` for the
      // edit dialog) arrive unformatted — group them once the field is touched.
      if (digits && input.value !== groupThousands(digits)) {
        input.value = groupThousands(digits)
      }
      onFocus?.(event)
    }

    // A controlled caller keeps the raw digits in state, so the rendered value
    // has to be grouped here for the separator to survive re-renders.
    const value =
      groupsThousands && typeof props.value === "string"
        ? groupThousands(props.value.replace(/\D/g, ""))
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
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
