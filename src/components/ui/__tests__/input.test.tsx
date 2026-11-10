import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { Input } from "../input"

function AmountForm({
  onSubmit,
  initialAmount = "",
}: {
  onSubmit: (data: { amount: string }) => void
  initialAmount?: string
}) {
  const { register, handleSubmit } = useForm<{ amount: string }>({
    defaultValues: { amount: initialAmount },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} role="form">
      <Input
        aria-label="Amount"
        type="text"
        inputMode="numeric"
        delimiters="period"
        {...register("amount")}
      />
      <button type="submit">Submit</button>
    </form>
  )
}

describe("Input with delimiters", () => {
  it("groups thousands in the DOM but reports raw digits to the form", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AmountForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText("Amount"), "1500000")
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("1.500.000")

    await user.click(screen.getByText("Submit"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toEqual({ amount: "1500000" })
  })

  it("keeps reporting digits after the field is blurred", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AmountForm onSubmit={onSubmit} />)

    const amount = screen.getByLabelText("Amount")
    await user.type(amount, "1000000")
    // Blurring is where react-hook-form used to re-read the grouped DOM value
    // and validate "1.000.000" as the amount — Number() of that is NaN.
    await user.click(screen.getByText("Submit"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toEqual({ amount: "1000000" })
  })

  it("groups a pre-filled whole number but submits its digits", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AmountForm onSubmit={onSubmit} initialAmount="1500000" />)

    const amount = screen.getByLabelText("Amount") as HTMLInputElement
    await user.click(amount)
    expect(amount.value).toBe("1.500.000")

    await user.click(screen.getByText("Submit"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toEqual({ amount: "1500000" })
  })

  it("leaves a fractional pre-filled value untouched", async () => {
    // A CSV import can store 1500.75. Its dot is a decimal separator, so it
    // must not be regrouped into 150.075 (or submitted as 150075).
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AmountForm onSubmit={onSubmit} initialAmount="1500.75" />)

    const amount = screen.getByLabelText("Amount") as HTMLInputElement
    await user.click(amount)
    expect(amount.value).toBe("1500.75")

    await user.click(screen.getByText("Submit"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toEqual({ amount: "1500.75" })
  })

  it("renders a controlled fractional value as-is", () => {
    render(
      <Input
        aria-label="Controlled"
        type="text"
        inputMode="numeric"
        delimiters="period"
        value="9999999.5"
        onChange={() => {}}
      />,
    )
    expect((screen.getByLabelText("Controlled") as HTMLInputElement).value).toBe("9999999.5")
  })
})
