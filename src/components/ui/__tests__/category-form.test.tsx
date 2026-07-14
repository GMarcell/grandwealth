import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { categoryFormSchema } from "@/lib/validation"
import { FormError } from "../form-error"

type CategoryFormData = {
  name: string
  type: "INCOME" | "EXPENSE"
  color?: string
}

function CategoryForm({ onSubmit = vi.fn() }: { onSubmit?: (data: CategoryFormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "", type: "EXPENSE", color: "#6366f1" },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} role="form">
      <div>
        <label htmlFor="name">Category Name</label>
        <input id="name" {...register("name")} />
        <FormError errors={errors} name="name" />
      </div>
      <div>
        <label htmlFor="type">Type</label>
        <select id="type" {...register("type")}>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
        <FormError errors={errors} name="type" />
      </div>
      <button type="submit">Submit</button>
    </form>
  )
}

describe("Category form validation", () => {
  it("shows name required error on empty form", async () => {
    const onSubmit = vi.fn()
    render(<CategoryForm onSubmit={onSubmit} />)
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Name is required")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("rejects name exceeding max length (50 chars)", async () => {
    const onSubmit = vi.fn()
    render(<CategoryForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category name/i), {
      target: { value: "A".repeat(51) },
    })
    fireEvent.submit(screen.getByRole("form"))

    // zod's .max(50) fails without a custom message, check onSubmit not called
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled())
  })

  it("calls onSubmit with valid data", async () => {
    const onSubmit = vi.fn()
    render(<CategoryForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category name/i), {
      target: { value: "PETROL" },
    })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "PETROL", type: "EXPENSE" })
  })
})
