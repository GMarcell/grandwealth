import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { stockFormSchema } from "@/lib/validation"
import { FormError } from "../form-error"

type StockFormData = {
  symbol: string
  name: string
  quantity: string
  buyPrice: string
  date: string
  notes?: string
}

function StockForm({ onSubmit = vi.fn() }: { onSubmit?: (data: StockFormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<StockFormData>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: { symbol: "", name: "", quantity: "", buyPrice: "", date: "2026-07-15", notes: "" },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} role="form">
      <div>
        <label htmlFor="symbol">Symbol</label>
        <input id="symbol" {...register("symbol")} />
        <FormError errors={errors} name="symbol" />
      </div>
      <div>
        <label htmlFor="name">Company Name</label>
        <input id="name" {...register("name")} />
        <FormError errors={errors} name="name" />
      </div>
      <div>
        <label htmlFor="quantity">Quantity</label>
        <input id="quantity" type="number" {...register("quantity")} />
        <FormError errors={errors} name="quantity" />
      </div>
      <div>
        <label htmlFor="buyPrice">Buy Price</label>
        <input id="buyPrice" type="number" {...register("buyPrice")} />
        <FormError errors={errors} name="buyPrice" />
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

describe("Stocks form validation", () => {
  it("shows required errors on empty form", async () => {
    const onSubmit = vi.fn()
    render(<StockForm onSubmit={onSubmit} />)
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Symbol is required")).toBeDefined())
    expect(screen.getByText("Name is required")).toBeDefined()
    expect(screen.getByText("Quantity is required")).toBeDefined()
    expect(screen.getByText("Buy price is required")).toBeDefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows error for non-integer quantity", async () => {
    const onSubmit = vi.fn()
    render(<StockForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/symbol/i), { target: { value: "BBCA" } })
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Bank BCA" } })
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "1.5" } })
    fireEvent.change(screen.getByLabelText(/buy price/i), { target: { value: "10000" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Quantity must be a positive integer")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows error for zero quantity", async () => {
    const onSubmit = vi.fn()
    render(<StockForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/symbol/i), { target: { value: "BBCA" } })
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Bank BCA" } })
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "0" } })
    fireEvent.change(screen.getByLabelText(/buy price/i), { target: { value: "10000" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Quantity must be a positive integer")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows error for negative buy price", async () => {
    const onSubmit = vi.fn()
    render(<StockForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/symbol/i), { target: { value: "BBCA" } })
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Bank BCA" } })
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText(/buy price/i), { target: { value: "-500" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(screen.getByText("Buy price must be a positive number")).toBeDefined())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("calls onSubmit with valid data", async () => {
    const onSubmit = vi.fn()
    render(<StockForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/symbol/i), { target: { value: "BBCA" } })
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Bank BCA" } })
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText(/buy price/i), { target: { value: "10000" } })
    fireEvent.submit(screen.getByRole("form"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      symbol: "BBCA", name: "Bank BCA", quantity: "1", buyPrice: "10000",
    })
  })
})
