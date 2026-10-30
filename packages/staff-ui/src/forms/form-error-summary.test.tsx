import { Field, TextInput } from "@auction/ui/lax";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormErrorSummary } from "./form-section.js";

const errors = [
  { fieldId: "title", message: "Enter the artwork's title." },
  { fieldId: "price", message: "Enter a price of at least £1.00." },
];

function Form({ shown, focusKey }: { shown: typeof errors; focusKey?: number }) {
  return (
    <form>
      <FormErrorSummary errors={shown} {...(focusKey === undefined ? {} : { focusKey })} />
      <Field label="Title" id="title" error={shown[0]?.message}>
        <TextInput />
      </Field>
      <Field label="Price" id="price">
        <TextInput />
      </Field>
    </form>
  );
}

describe("FormErrorSummary", () => {
  it("renders nothing without errors", () => {
    render(<Form shown={[]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("takes focus when it appears, titled so it can be found again", () => {
    const { rerender } = render(<Form shown={[]} />);
    rerender(<Form shown={errors} />);
    const summary = screen.getByRole("alert", { name: "There is a problem" });
    expect(summary).toHaveFocus();
    expect(summary).toHaveAttribute("tabindex", "-1");
  });

  it("links each error to its field and moves focus there", () => {
    render(<Form shown={errors} />);
    fireEvent.click(screen.getByRole("link", { name: "Enter a price of at least £1.00." }));
    expect(screen.getByLabelText("Price")).toHaveFocus();
  });

  it("gives each error link a 24px target, so stacked links are easy to hit", () => {
    render(<Form shown={errors} />);
    const link = screen.getByRole("link", { name: "Enter a price of at least £1.00." });
    expect(link).toHaveClass("inline-block", "leading-6");
  });

  it("with a focus key, refocuses on each failed submit but not while fields are fixed", () => {
    const { rerender } = render(<Form shown={[]} focusKey={0} />);
    rerender(<Form shown={errors} focusKey={1} />);
    expect(screen.getByRole("alert")).toHaveFocus();

    screen.getByLabelText("Title").focus();
    rerender(<Form shown={errors.slice(1)} focusKey={1} />);
    expect(screen.getByLabelText("Title")).toHaveFocus();

    rerender(<Form shown={errors} focusKey={2} />);
    expect(screen.getByRole("alert")).toHaveFocus();
  });
});
