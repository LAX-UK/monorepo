import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LaxLockup } from "./lax-lockup.js";

describe("LaxLockup", () => {
  it("is announced by the product name", () => {
    render(<LaxLockup kind="account" />);
    expect(screen.getByRole("img", { name: "LAX Account" })).toBeTruthy();
  });

  it("colours only the descriptor with the app's product accent", () => {
    const { container } = render(<LaxLockup kind="account" />);
    const accented = container.querySelectorAll("path[style]");
    // Dot plus the seven letters of ACCOUNT.
    expect(accented).toHaveLength(8);
    for (const path of accented) {
      expect(path.getAttribute("style")).toContain("var(--color-product-accent, currentColor)");
    }
  });

  it("keeps the mark on the text colour so it follows the theme", () => {
    const { container } = render(<LaxLockup kind="shop" />);
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
  });

  it("passes the size class through", () => {
    const { container } = render(<LaxLockup kind="art" className="h-8 w-auto" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("h-8 w-auto");
  });
});
