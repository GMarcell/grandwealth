import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { recurringFormSchema } from "@/lib/validation"
import { FormError } from "../form-error"

type RecurringFormData = {
  type: "INCOME" | "EXPENSE"
  category: string
  amount: string
  description: string
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY"
  startDate: string
  endDate?: string
  nextDate: string
}

function RecurringForm({ onSubmit = vi.fn() }: { onSubmit?: (data: RecurringFormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<RecurringFormData>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      type: "EXPENSE", category: "", amount: "", description: "",
      frequency: "MONTHLY", startDate: "2026-07-01", endDate: "", nextDate: "2026-07-15",
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} role="form">
      <div>
        <label htmlFor="type">Type</label>
        <select id="type" {...register("type")}>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
        <FormError errors={errors} name="type" />
      </div>
      <div>
        <label htmlFor="cat">Category</label>
        <input id="cat" {...register("category")} />
        <FormError errors={errors} name="category" />
      </div>
      <div>
        <label htmlFor="amount">Amount (Rp)</label>
        <input id="amount" type="number" {...register("amount")} />
        <FormError errors={errors} name="amount" />
      </div>
      <div>
        <label htmlFor="desc">Description</label>
        <input id="desc" {...register("description")} />
        <FormError errors={errors} name="description" />
      </div>
      <div>
        <label htmlFor="start">Start Date</label>
        <input id="start" type="date" {...register("startDate")} />
        <FormError errors={errors} name="startDate" />
      </div>
      <div>
        <label htmlFor="next">Next Date</label>
        <input id="next" type="date" {...register("nextDate")} />
        <FormError errors={errors} name="nextDate" />
      </div>
      <button type="submit">Submit</button>
    </form>
  )
}

describe("Recurring form validation", () => {
  it("shows all required errors on empty form", async () => {
    const onSubmit = vi.fn()
    render(<RecurringForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Category is required")).toBeDefined())
    expect(screen.getByText("Amount is required")).toBeDefined()
    expect(screen.getByText("Description is required")).toBeDefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows amount error for zero", async () => {
    const onSubmit = vi.fn()
    render(<RecurringForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "FOOD" } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "0" } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Test" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Amount must be a positive number")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("calls onSubmit with valid data", async () => {
    const onSubmit = vi.fn()
    render(<RecurringForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "FOOD" } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "500000" } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Groceries" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const data = onSubmit.mock.calls[0][0]
    expect(data).toMatchObject({ category: "FOOD", amount: "500000", description: "Groceries" })
  })
})
