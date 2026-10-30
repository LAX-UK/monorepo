import { Field } from "@auction/ui/lax";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatRateAsPercent, formatStaffPercent, parsePercentToRate } from "../lib/percent.js";
import { PercentInput } from "./percent-input.js";

describe("percent conversion", () => {
  it.each([
    ["25", "0.25"],
    ["12.5", "0.125"],
    ["12.5 %", "0.125"],
    ["100", "1"],
    ["7", "0.07"],
    ["0", "0"],
    [".5", "0.005"],
    ["150", "1.5"],
    ["0.123", "0.00123"],
  ])("reads %s as the rate %s", (input, rate) => {
    expect(parsePercentToRate(input)).toEqual({ ok: true, rate });
  });

  it("says when the text is empty or not a number", () => {
    expect(parsePercentToRate(" ")).toEqual({ ok: false, reason: "empty" });
    expect(parsePercentToRate("abc")).toEqual({ ok: false, reason: "invalid" });
    expect(parsePercentToRate("1.2.3")).toEqual({ ok: false, reason: "invalid" });
    expect(parsePercentToRate("-5")).toEqual({ ok: false, reason: "invalid" });
  });

  it.each([
    ["0.25", "25"],
    ["0.125", "12.5"],
    ["1", "100"],
    ["0.07", "7"],
    ["0", "0"],
    ["0.2500", "25"],
  ])("shows the rate %s as %s", (rate, text) => {
    expect(formatRateAsPercent(rate)).toBe(text);
  });

  it("formats a rate for display", () => {
    expect(formatStaffPercent("0.25")).toBe("25%");
    expect(formatStaffPercent(0.155)).toBe("15.5%");
    expect(formatStaffPercent("n/a")).toBe("n/a");
  });
});

describe("PercentInput in a Field", () => {
  it("shows the rate as a percent and hands the form the decimal rate", () => {
    const onValueChange = vi.fn();
    render(
      <Field label="Flat rate" description="Charged on the hammer price">
        <PercentInput value="0.25" onValueChange={onValueChange} />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Flat rate" });
    expect(input).toHaveValue("25");
    expect(input).toHaveAccessibleDescription("Charged on the hammer price");
    fireEvent.change(input, { target: { value: "17.5" } });
    expect(onValueChange).toHaveBeenLastCalledWith("0.175");
    expect(input).toHaveValue("17.5");
  });

  it("reports an empty field and text that is not a number apart", () => {
    const onValueChange = vi.fn();
    render(
      <Field label="Rate">
        <PercentInput value="" onValueChange={onValueChange} />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Rate" });
    fireEvent.change(input, { target: { value: "ten" } });
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    fireEvent.change(input, { target: { value: "" } });
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("marks the control invalid and announces the error", () => {
    render(
      <Field label="Rate" error="Enter a rate from 0% to 100%.">
        <PercentInput value="" onValueChange={() => {}} />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Rate" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a rate from 0% to 100%.");
  });
});
