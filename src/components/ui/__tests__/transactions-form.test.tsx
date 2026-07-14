import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { transactionFormSchema } from "@/lib/validation"
import { FormError } from "../form-error"

type TransactionFormData = {
  type: "INCOME" | "EXPENSE"
  category: string
  amount: string
  description: string
  date: string
}

function TransactionForm({ onSubmit = vi.fn() }: { onSubmit?: (data: TransactionFormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: { type: "EXPENSE", category: "", amount: "", description: "", date: "2026-07-15" },
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
        <label htmlFor="date">Date</label>
        <input id="date" type="date" {...register("date")} />
        <FormError errors={errors} name="date" />
      </div>
      <button type="submit">Submit</button>
    </form>
  )
}

describe("Transaction form validation", () => {
  it("shows required errors on empty form", async () => {
    const onSubmit = vi.fn()
    render(<TransactionForm onSubmit={onSubmit} />)

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
    render(<TransactionForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "FOOD" } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "0" } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Lunch" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Amount must be a positive number")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows amount error for negative", async () => {
    const onSubmit = vi.fn()
    render(<TransactionForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "FOOD" } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "-100" } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Lunch" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Amount must be a positive number")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("calls onSubmit with valid data", async () => {
    const onSubmit = vi.fn()
    render(<TransactionForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "FOOD" } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "50000" } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Lunch" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      category: "FOOD", amount: "50000", description: "Lunch", type: "EXPENSE",
    })
  })
})
