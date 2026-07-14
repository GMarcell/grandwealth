import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { savingsFormSchema } from "@/lib/validation"
import { FormError } from "../form-error"

type SavingsFormData = {
  type: "DEPOSIT" | "WITHDRAWAL"
  accountName: string
  amount: string
  date: string
  notes?: string
}

function SavingsForm({ onSubmit = vi.fn() }: { onSubmit?: (data: SavingsFormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<SavingsFormData>({
    resolver: zodResolver(savingsFormSchema),
    defaultValues: { type: "DEPOSIT", accountName: "", amount: "", date: "2026-07-15", notes: "" },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} role="form">
      <div>
        <label htmlFor="type">Type</label>
        <select id="type" {...register("type")}>
          <option value="DEPOSIT">Deposit</option>
          <option value="WITHDRAWAL">Withdrawal</option>
        </select>
        <FormError errors={errors} name="type" />
      </div>
      <div>
        <label htmlFor="account">Account Name</label>
        <input id="account" {...register("accountName")} />
        <FormError errors={errors} name="accountName" />
      </div>
      <div>
        <label htmlFor="amount">Amount (Rp)</label>
        <input id="amount" type="number" {...register("amount")} />
        <FormError errors={errors} name="amount" />
      </div>
      <div>
        <label htmlFor="date">Date</label>
        <input id="date" type="date" {...register("date")} />
        <FormError errors={errors} name="date" />
      </div>
      <button type="submit">Submit</button>
    </form>
  )
}

describe("Savings form validation", () => {
  it("shows required errors on empty form", async () => {
    const onSubmit = vi.fn()
    render(<SavingsForm onSubmit={onSubmit} />)
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Account name is required")).toBeDefined())
    expect(screen.getByText("Amount is required")).toBeDefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows error for zero amount", async () => {
    const onSubmit = vi.fn()
    render(<SavingsForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: "BCA" } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "0" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Amount must be a positive number")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("calls onSubmit with valid data", async () => {
    const onSubmit = vi.fn()
    render(<SavingsForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: "BCA" } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "1000000" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ accountName: "BCA", amount: "1000000" })
  })
})
