import { describe, expect, it } from "vitest";
import { socialErrorMessage } from "./social-errors.js";

describe("socialErrorMessage", () => {
  it("maps known OAuth callback codes", () => {
    expect(socialErrorMessage("access_denied")).toContain("cancelled");
    expect(socialErrorMessage("account_not_linked")).toContain("password");
  });

  it("returns null when no code is present", () => {
    expect(socialErrorMessage(null)).toBeNull();
    expect(socialErrorMessage("")).toBeNull();
  });

  it("falls back for unknown codes", () => {
    expect(socialErrorMessage("unknown_code")).toContain("Try again");
  });
});
