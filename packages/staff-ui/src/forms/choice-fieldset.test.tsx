// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChoiceFieldset } from "./choice-fieldset.js";

describe("ChoiceFieldset", () => {
  afterEach(cleanup);

  it("names the group by its legend and reads the guidance and error with it", () => {
    render(
      <ChoiceFieldset
        id="signature"
        legend="Signature"
        description="How every print is signed."
        error="Choose how the prints are signed"
      >
        <input type="radio" aria-label="Unsigned" />
      </ChoiceFieldset>,
    );
    const group = screen.getByRole("group", { name: "Signature" });
    expect(group.getAttribute("aria-invalid")).toBe("true");
    const describedBy = group.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ")).toEqual(["signature-description", "signature-error"]);
    expect(document.getElementById("signature-error")?.textContent).toBe(
      "Choose how the prints are signed",
    );
  });

  it("can take focus for an error summary link, and marks an optional group", () => {
    render(
      <ChoiceFieldset id="proofs" legend="Proofs kept" optional>
        <input aria-label="Artist's proofs" />
      </ChoiceFieldset>,
    );
    const group = screen.getByRole("group", { name: /Proofs kept/ });
    group.focus();
    expect(document.activeElement).toBe(group);
    expect(group.textContent).toContain("Optional");
    expect(group.hasAttribute("aria-invalid")).toBe(false);
  });
});
