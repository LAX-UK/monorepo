import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoiceRow, StaffSwitch, choiceReasonId } from "./choice.js";

describe("StaffSwitch with a disabled reason", () => {
  it("keeps focus, says why on its own line, and never changes", () => {
    const onCheckedChange = vi.fn();
    render(
      <ChoiceRow
        htmlFor="raise"
        label="Raise storage invoices"
        description="When on, buyers are invoiced."
        disabledReason="Choose a VAT treatment first."
        control={
          <StaffSwitch
            id="raise"
            checked={false}
            disabledReason="Choose a VAT treatment first."
            aria-describedby={choiceReasonId("raise")}
            onCheckedChange={onCheckedChange}
          />
        }
      />,
    );
    const control = screen.getByRole("switch", { name: /Raise storage invoices/ });
    expect(control).not.toBeDisabled();
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAccessibleDescription("Choose a VAT treatment first.");
    control.focus();
    expect(control).toHaveFocus();
    fireEvent.click(control);
    fireEvent.click(screen.getByText("Raise storage invoices"));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(control).not.toBeChecked();
  });

  it("works as a plain switch without a reason", () => {
    const onCheckedChange = vi.fn();
    render(
      <ChoiceRow
        htmlFor="raise"
        label="Raise storage invoices"
        control={<StaffSwitch id="raise" checked={false} onCheckedChange={onCheckedChange} />}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText(/VAT/)).toBeNull();
  });
});
