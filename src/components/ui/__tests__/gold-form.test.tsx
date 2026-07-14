import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { goldFormSchema } from "@/lib/validation"
import { FormError } from "../form-error"

type GoldFormData = {
  type: "BUY" | "SELL"
  weight: string
  price: string
  date: string
  notes?: string
}

function GoldForm({ onSubmit = vi.fn() }: { onSubmit?: (data: GoldFormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<GoldFormData>({
    resolver: zodResolver(goldFormSchema),
    defaultValues: { type: "BUY", weight: "", price: "", date: "2026-07-15", notes: "" },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} role="form">
      <div>
        <label htmlFor="type">Type</label>
        <select id="type" {...register("type")}>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>
        <FormError errors={errors} name="type" />
      </div>
      <div>
        <label htmlFor="weight">Weight (grams)</label>
        <input id="weight" type="number" {...register("weight")} />
        <FormError errors={errors} name="weight" />
      </div>
      <div>
        <label htmlFor="price">Price per Gram (Rp)</label>
        <input id="price" type="number" {...register("price")} />
        <FormError errors={errors} name="price" />
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

describe("Gold form validation", () => {
  it("shows all required errors on empty form", async () => {
    const onSubmit = vi.fn()
    render(<GoldForm onSubmit={onSubmit} />)
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Weight is required")).toBeDefined())
    expect(screen.getByText("Price is required")).toBeDefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows error for invalid weight (zero)", async () => {
    const onSubmit = vi.fn()
    render(<GoldForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: "0" } })
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: "1000000" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Weight must be a positive number")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows error for invalid price (negative)", async () => {
    const onSubmit = vi.fn()
    render(<GoldForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: "10" } })
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: "-100" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Price must be a positive number")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("calls onSubmit with valid data", async () => {
    const onSubmit = vi.fn()
    render(<GoldForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: "10" } })
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: "1000000" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ weight: "10", price: "1000000", type: "BUY" })
  })
})
