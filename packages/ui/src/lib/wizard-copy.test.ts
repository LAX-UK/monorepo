import { describe, expect, it } from "vitest";
import { wizardContinueLabel } from "./wizard-copy.js";

describe("wizardContinueLabel", () => {
  it("names the next step when provided", () => {
    expect(wizardContinueLabel("Details")).toBe("Continue to Details");
  });

  it("falls back to Continue", () => {
    expect(wizardContinueLabel()).toBe("Continue");
  });
});
