import { describe, expect, it } from "vitest";
import { accountButtonClass } from "./account-button";

describe("accountButtonClass", () => {
  it("draws the outline edge with the control-border token, not the faint hairline", () => {
    const classes = accountButtonClass("outline", "default");
    expect(classes).toContain("border-control-border");
    expect(classes).not.toContain("border-outline-variant");
  });

  it("leaves other variants without an outline edge", () => {
    expect(accountButtonClass("default", "default")).not.toContain("border-control-border");
  });
});
