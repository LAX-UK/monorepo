// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TextField } from "./fields";
import { FormErrorSummary } from "./form-error-summary";
import { FormScopeProvider } from "./form-field";

const ERRORS = { email: "Enter the email address.", role: "Choose a role." };

function Harness() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <FormScopeProvider value="form">
      {Object.keys(errors).length > 0 ? <FormErrorSummary scope="form" errors={errors} /> : null}
      <TextField name="email" label="Email" value="" error={errors.email} onChange={() => {}} />
      <button type="button" onClick={() => setErrors({ ...ERRORS })}>
        Submit
      </button>
    </FormScopeProvider>
  );
}

describe("FormErrorSummary", () => {
  it("takes focus when a failed submit produces errors", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "There is a problem" })).toBeInTheDocument();
  });

  it("links each error to its field and moves focus there", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("link", { name: "Enter the email address." }));
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });
});
