import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChoiceRow,
  StaffCheckbox,
  StaffRadio,
  StaffRadioGroup,
  StaffSwitch,
  choiceReasonId,
} from "./choice.js";

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

describe("checkbox and radio hit area (CRF-6)", () => {
  // jsdom does not lay out, so the classes are the contract: a 16px box with an unpainted layer
  // 4px past each edge, which makes the press target 24px square.
  const hitArea = (el: HTMLElement) => el.className.split(/\s+/);

  it("defines the target in theme.css: 4px past each edge, never shrinking", () => {
    const css = readFileSync(join(process.cwd(), "src/theme.css"), "utf8");
    const rule = css.slice(css.indexOf("@utility staff-hit"));
    expect(rule).toContain("position: relative");
    expect(rule).toContain("flex-shrink: 0");
    expect(rule).toContain("inset: -4px");
  });

  it("draws the checkbox at 16px and gives it a 24px target", () => {
    render(<StaffCheckbox aria-label="Select row" />);
    const classes = hitArea(screen.getByRole("checkbox", { name: "Select row" }));
    expect(classes).toContain("size-4");
    expect(classes).toEqual(expect.arrayContaining(["staff-hit"]));
  });

  it("gives the radio the same 24px target", () => {
    render(
      <StaffRadioGroup aria-label="Reason">
        <StaffRadio value="a" aria-label="Damaged" />
      </StaffRadioGroup>,
    );
    const classes = hitArea(screen.getByRole("radio", { name: "Damaged" }));
    expect(classes).toContain("size-4");
    expect(classes).toEqual(expect.arrayContaining(["staff-hit"]));
  });

  it("keeps the hit area when a page adds its own classes", () => {
    render(<StaffCheckbox aria-label="Acknowledge" className="mt-0.5" />);
    const classes = hitArea(screen.getByRole("checkbox", { name: "Acknowledge" }));
    expect(classes).toEqual(expect.arrayContaining(["mt-0.5", "staff-hit"]));
  });
});
