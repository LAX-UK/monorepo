import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LaxLogo } from "./lax-logo.js";

describe("LaxLogo", () => {
  it("is the inline London Art Exchange vector, announced by name", () => {
    render(<LaxLogo />);
    expect(screen.getByRole("img", { name: "LAX London Art Exchange" })).toBeTruthy();
  });

  it("paints with the wrapper colour and loads no image", () => {
    const { container } = render(<LaxLogo className="art-header__logo" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
    expect(container.firstElementChild?.className).toContain("lax-logo");
    expect(container.firstElementChild?.className).toContain("art-header__logo");
  });
});
