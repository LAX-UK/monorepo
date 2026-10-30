import { Field } from "@auction/ui/lax";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoneyInput } from "./money-input.js";

describe("MoneyInput in a Field", () => {
  it("is labelled, described and hands the form whole pence", () => {
    const onValueChange = vi.fn();
    render(
      <Field label="Amount" description="Up to £20.00">
        <MoneyInput value={null} onValueChange={onValueChange} />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Amount" });
    expect(input).toHaveAccessibleDescription("Up to £20.00");
    fireEvent.change(input, { target: { value: "12.5" } });
    expect(onValueChange).toHaveBeenLastCalledWith(1250);
    fireEvent.blur(input);
    expect(input).toHaveValue("12.50");
  });

  it("reports nothing for text that is not an amount", () => {
    const onValueChange = vi.fn();
    render(
      <Field label="Amount">
        <MoneyInput value={null} onValueChange={onValueChange} />
      </Field>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), {
      target: { value: "12.345" },
    });
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("marks the control invalid and announces the error", () => {
    render(
      <Field label="Amount" error="Enter an amount.">
        <MoneyInput value={null} onValueChange={() => {}} />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Amount" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter an amount.");
  });
});
