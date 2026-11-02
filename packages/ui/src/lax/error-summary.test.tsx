import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorSummary, Field, TextInput } from "./index.js";

const ERRORS = [
  { fieldId: "email", message: "Enter your email address" },
  { fieldId: "message", message: "Enter your message" },
];

describe("ErrorSummary", () => {
  it("renders nothing without errors", () => {
    const { container } = render(<ErrorSummary errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is an alert named by its title and lists each message as a link to its field", () => {
    render(<ErrorSummary errors={ERRORS} />);
    expect(screen.getByRole("alert", { name: "There is a problem" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter your email address" })).toHaveAttribute(
      "href",
      "#email",
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("takes focus when it appears", () => {
    render(<ErrorSummary errors={ERRORS} />);
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("takes focus once per failed submit, not each time the errors change", () => {
    const { rerender } = render(<ErrorSummary errors={ERRORS} focusKey={1} />);
    screen.getByRole("alert").blur();
    rerender(<ErrorSummary errors={ERRORS.slice(0, 1)} focusKey={1} />);
    expect(screen.getByRole("alert")).not.toHaveFocus();
    rerender(<ErrorSummary errors={ERRORS} focusKey={2} />);
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("moves focus to the field when a line is chosen", () => {
    render(
      <>
        <ErrorSummary errors={ERRORS} />
        <Field label="Email" error="Enter your email address" id="email">
          <TextInput />
        </Field>
      </>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Enter your email address" }));
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });
});
