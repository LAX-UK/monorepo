import { describe, expect, it } from "vitest";
import { socialErrorMessage } from "./social-error-message";

describe("socialErrorMessage", () => {
  it("maps known OAuth error codes", () => {
    expect(socialErrorMessage("account_not_linked")).toMatch(/not linked/i);
    expect(socialErrorMessage("banned")).toMatch(/cannot sign in/i);
  });

  it("falls back to generic copy", () => {
    expect(socialErrorMessage("unknown_code")).toMatch(/Could not sign in/i);
    expect(socialErrorMessage(null)).toMatch(/Could not sign in/i);
  });
});
