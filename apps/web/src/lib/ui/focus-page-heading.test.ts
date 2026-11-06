import { afterEach, describe, expect, it } from "vitest";
import { focusPageHeading } from "./focus-page-heading";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("focusPageHeading", () => {
  it("focuses the page's h1 without making it a tab stop", () => {
    document.body.innerHTML = "<header><h1>Site</h1></header><main><h1>Home</h1></main>";
    expect(focusPageHeading()).toBe(true);
    expect(document.activeElement?.textContent).toBe("Home");
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  });

  it("falls back to the first h1 outside a main landmark", () => {
    document.body.innerHTML = "<div><h1>Bids</h1></div>";
    expect(focusPageHeading()).toBe(true);
    expect(document.activeElement?.textContent).toBe("Bids");
  });

  it("does nothing when there is no heading", () => {
    document.body.innerHTML = "<main><p>Hello</p></main>";
    expect(focusPageHeading()).toBe(false);
  });
});
