import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFormErrorSummary } from "./marketing-form-error-summary.js";
import { MarketingFormField } from "./marketing-form-field.js";

describe("MarketingFormField", () => {
  it("ties the hint to the control and marks optional questions in words", () => {
    render(
      <MarketingFormField id="line2" label="Address line 2" optional hint="Flat or building">
        {(control) => <input {...control} />}
      </MarketingFormField>,
    );
    const input = screen.getByRole("textbox", { name: "Address line 2 (optional)" });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Flat or building");
  });

  it("reads the error before the hint and marks the control invalid", () => {
    render(
      <MarketingFormField
        id="postcode"
        label="Postcode"
        hint="For example SW1A 1AA"
        error="Enter a UK postcode"
      >
        {(control) => <input {...control} />}
      </MarketingFormField>,
    );
    const input = screen.getByRole("textbox", { name: "Postcode" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Error: Enter a UK postcode For example SW1A 1AA");
  });
});

describe("MarketingFormErrorSummary", () => {
  const errors = [
    { fieldId: "name", message: "Enter the recipient's full name" },
    { fieldId: "postcode", message: "Enter a UK postcode" },
  ];

  it("renders nothing without errors", () => {
    const { container } = render(<MarketingFormErrorSummary errors={[]} focusKey={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("takes focus once per failed submit, not when errors change in between", () => {
    const { rerender } = render(
      <>
        <input aria-label="other" />
        <MarketingFormErrorSummary errors={errors} focusKey={1} />
      </>,
    );
    const summary = screen.getByRole("alert", { name: "There is a problem" });
    expect(summary).toHaveFocus();

    screen.getByRole("textbox", { name: "other" }).focus();
    rerender(
      <>
        <input aria-label="other" />
        <MarketingFormErrorSummary errors={errors.slice(1)} focusKey={1} />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "other" })).toHaveFocus();

    rerender(
      <>
        <input aria-label="other" />
        <MarketingFormErrorSummary errors={errors.slice(1)} focusKey={2} />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("does not take focus before the first submit", () => {
    render(<MarketingFormErrorSummary errors={errors} focusKey={0} />);
    expect(screen.getByRole("alert")).not.toHaveFocus();
  });

  it("links each message to its field and moves focus there", () => {
    render(
      <>
        <MarketingFormErrorSummary errors={errors} focusKey={1} />
        <label htmlFor="postcode">Postcode</label>
        <input id="postcode" />
      </>,
    );
    const link = screen.getByRole("link", { name: "Enter a UK postcode" });
    expect(link).toHaveAttribute("href", "#postcode");
    fireEvent.click(link);
    expect(screen.getByRole("textbox", { name: "Postcode" })).toHaveFocus();
  });
});
