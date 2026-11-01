import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, TextInput } from "./index.js";

describe("Field", () => {
  it("announces the error with the control and sets it at 13/20 for client density", () => {
    render(
      <Field label="Email" error="Enter your email address">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter your email address");
    const message = screen.getByText("Enter your email address");
    expect(message.className).toContain("in-data-[lax-density=client]:text-lax-13");
    expect(message.className).toContain("in-data-[lax-density=client]:leading-5");
  });

  it("keeps a hidden label available to assistive technology", () => {
    render(
      <Field label="Email address" labelHidden>
        <TextInput />
      </Field>,
    );
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByText("Email address").parentElement?.className).toContain("sr-only");
  });
});
