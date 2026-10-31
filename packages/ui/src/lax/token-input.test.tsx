import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TokenInput, splitTokens } from "./index.js";

function Harness({ initial = [] as string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <>
      <TokenInput
        aria-label="Email addresses"
        value={value}
        onValueChange={setValue}
        normalise={(t) => t.toLowerCase()}
        validate={(t) => (t.includes("@") ? null : "Not an email address")}
      />
      <output data-testid="value">{value.join("|")}</output>
    </>
  );
}

describe("TokenInput", () => {
  it("splits pasted lists on commas, semicolons and spaces", () => {
    expect(splitTokens(" a@x.com, b@x.com;c@x.com\nd@x.com ")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("adds a chip when a separator is typed, normalised and without duplicates", () => {
    render(<Harness initial={["sam@x.com"]} />);
    const input = screen.getByLabelText("Email addresses");
    fireEvent.change(input, { target: { value: "SAM@x.com, olu@x.com," } });
    expect(screen.getByTestId("value").textContent).toBe("sam@x.com|olu@x.com");
    expect(input).toHaveValue("");
  });

  it("finishes on Enter and takes the last chip back on Backspace", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Email addresses");
    fireEvent.change(input, { target: { value: "a@x.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("value").textContent).toBe("a@x.com");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.getByTestId("value").textContent).toBe("");
    expect(input).toHaveValue("a@x.com");
  });

  it("marks an invalid chip and names it in its remove button", () => {
    render(<Harness initial={["not-an-email"]} />);
    expect(screen.getByLabelText("Email addresses")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(": Not an email address")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove not-an-email" }));
    expect(screen.getByTestId("value").textContent).toBe("");
  });
});
