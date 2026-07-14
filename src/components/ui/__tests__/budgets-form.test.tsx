import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { FormError } from "../form-error"

// Use the same pattern as budgetFormSchema from validation.ts
const testFormSchema = z.object({
  categoryName: z.string().min(1, "Category is required"),
  amount: z.string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be a positive number"),
  rolloverEnabled: z.boolean(),
  rolloverCap: z.string().optional(),
})

type TestFormData = z.infer<typeof testFormSchema>

interface TestFormProps {
  onSubmit?: (data: TestFormData) => void
}

function TestForm({ onSubmit = vi.fn() }: TestFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TestFormData>({
    resolver: zodResolver(testFormSchema),
    defaultValues: {
      categoryName: "",
      amount: "",
      rolloverEnabled: true,
      rolloverCap: "",
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} role="form">
      <div>
        <label htmlFor="cat">Category</label>
        <select id="cat" {...register("categoryName")}>
          <option value="">Select category</option>
          <option value="FOOD">FOOD</option>
          <option value="TRANSPORTATION">TRANSPORTATION</option>
        </select>
        <FormError errors={errors} name="categoryName" />
      </div>

      <div>
        <label htmlFor="amount">Monthly Budget (Rp)</label>
        <input id="amount" type="number" {...register("amount")} />
        <FormError errors={errors} name="amount" />
      </div>

      <input type="hidden" {...register("rolloverEnabled")} value="true" />

      <button type="submit">Add Budget</button>
    </form>
  )
}

describe("Budget form validation integration", () => {
  it("shows both validation errors when submitting empty form", async () => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)

    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => {
      expect(screen.getByText("Category is required")).toBeDefined()
    })
    // Empty string fails .min(1) first, so error is "Amount is required"
    expect(screen.getByText("Amount is required")).toBeDefined()

    // onSubmit should not have been called
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("clears amount error when a valid amount is entered", async () => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)

    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => {
      expect(screen.getByText("Amount is required")).toBeDefined()
    })

    // Enter a valid amount
    fireEvent.change(screen.getByLabelText(/monthly budget/i), {
      target: { value: "1000000" },
    })

    // Resubmit - category still empty, but amount is now valid
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => {
      expect(screen.queryByText("Amount is required")).toBeNull()
    })
    // Category error should still be present
    expect(screen.getByText("Category is required")).toBeDefined()

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("calls onSubmit when both fields are valid", async () => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: "FOOD" },
    })
    fireEvent.change(screen.getByLabelText(/monthly budget/i), {
      target: { value: "1000000" },
    })

    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    const calledWith = onSubmit.mock.calls[0][0]
    expect(calledWith).toMatchObject({
      categoryName: "FOOD",
      amount: "1000000",
      rolloverEnabled: true,
    })
  })

  it("shows error for invalid amount (zero)", async () => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: "FOOD" },
    })
    fireEvent.change(screen.getByLabelText(/monthly budget/i), {
      target: { value: "0" },
    })

    fireEvent.submit(screen.getByRole("form"))

    // "0" passes .min(1) (length 1) but fails .refine() (not > 0)
    await waitFor(() => {
      expect(screen.getByText("Amount must be a positive number")).toBeDefined()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows error for invalid amount (negative)", async () => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: "FOOD" },
    })
    fireEvent.change(screen.getByLabelText(/monthly budget/i), {
      target: { value: "-500" },
    })

    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => {
      expect(screen.getByText("Amount must be a positive number")).toBeDefined()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("removes all errors when all fields are valid", async () => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)

    // Submit empty to trigger all errors
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => {
      expect(screen.getByText("Category is required")).toBeDefined()
      expect(screen.getByText("Amount is required")).toBeDefined()
    })

    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: "FOOD" },
    })
    fireEvent.change(screen.getByLabelText(/monthly budget/i), {
      target: { value: "500000" },
    })

    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => {
      expect(screen.queryByText("Category is required")).toBeNull()
      expect(screen.queryByText("Amount is required")).toBeNull()
    })

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
