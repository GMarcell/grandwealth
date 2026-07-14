import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { FormError } from "../form-error"
import type { FieldErrors } from "react-hook-form"

describe("FormError", () => {
  it("returns null when there are no errors", () => {
    const errors: FieldErrors = {}
    const { container } = render(<FormError errors={errors} name="amount" />)
    expect(container.firstChild).toBeNull()
  })

  it("returns null when the named field has no error", () => {
    const errors: FieldErrors = {
      name: { type: "required", message: "Name is required" },
    }
    const { container } = render(
      <FormError errors={errors} name="amount" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("returns null when error exists but has no message", () => {
    const errors: FieldErrors = {
      amount: { type: "required" },
    }
    const { container } = render(
      <FormError errors={errors} name="amount" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders the error message when present", () => {
    const errors: FieldErrors = {
      amount: { type: "required", message: "Amount is required" },
    }
    render(<FormError errors={errors} name="amount" />)
    expect(screen.getByText("Amount is required")).toBeDefined()
  })

  it("renders multiple errors independently", () => {
    const errors: FieldErrors = {
      name: { type: "required", message: "Name is required" },
      email: { type: "email", message: "Invalid email" },
    }
    render(
      <>
        <FormError errors={errors} name="name" />
        <FormError errors={errors} name="email" />
      </>,
    )
    expect(screen.getByText("Name is required")).toBeDefined()
    expect(screen.getByText("Invalid email")).toBeDefined()
  })

  it("uses role='alert' for accessibility", () => {
    const errors: FieldErrors = {
      amount: { type: "required", message: "Amount is required" },
    }
    render(<FormError errors={errors} name="amount" />)
    const element = screen.getByRole("alert")
    expect(element).toBeDefined()
    expect(element.textContent).toBe("Amount is required")
  })

  it("applies custom className", () => {
    const errors: FieldErrors = {
      amount: { type: "required", message: "Amount is required" },
    }
    render(
      <FormError errors={errors} name="amount" className="custom-class" />,
    )
    const element = screen.getByRole("alert")
    expect(element.className).toContain("custom-class")
  })

  it("includes animation classes by default", () => {
    const errors: FieldErrors = {
      amount: { type: "required", message: "Amount is required" },
    }
    render(<FormError errors={errors} name="amount" />)
    const element = screen.getByRole("alert")
    expect(element.className).toContain("animate-in")
    expect(element.className).toContain("fade-in")
    expect(element.className).toContain("slide-in-from-top-1")
  })

  it("renders an empty string message", () => {
    const errors: FieldErrors = {
      amount: { type: "required", message: "" },
    }
    const { container } = render(
      <FormError errors={errors} name="amount" />,
    )
    expect(container.firstChild).toBeNull()
  })
})
