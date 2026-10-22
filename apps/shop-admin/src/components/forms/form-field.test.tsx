// @vitest-environment jsdom
import { Input } from "@auction/ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./form-field";

function renderField(props: { hint?: string; error?: string }) {
  render(
    <FormField name="email" label="Email" {...props}>
      {(control) => <Input {...control} />}
    </FormField>,
  );
  return screen.getByLabelText("Email");
}

describe("FormField", () => {
  it("labels the control and leaves it valid when there is no error", () => {
    const input = renderField({});
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("ties the error to the control and marks it invalid", () => {
    const input = renderField({ error: "Enter the email address." });
    const error = screen.getByText("Enter the email address.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("describes the control by both its hint and its error", () => {
    const input = renderField({ hint: "Use the work address.", error: "Enter the email address." });
    const describedBy = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toEqual([
      screen.getByText("Use the work address.").id,
      screen.getByText("Enter the email address.").id,
    ]);
  });
});
