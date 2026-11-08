import { describe, expect, it } from "vitest";
import { socialErrorMessage } from "./social-errors.js";

describe("socialErrorMessage", () => {
  it("maps known OAuth callback codes", () => {
    expect(socialErrorMessage("access_denied")).toContain("cancelled");
    expect(socialErrorMessage("account_not_linked")).toBe(
      "There's already a LAX Account for this email. Sign in the way you usually do.",
    );
  });

  it("says plainly when Google and Apple sign-in is unavailable", () => {
    expect(socialErrorMessage("social_sign_in_unavailable")).toContain("isn't available just now");
  });

  it("explains a refused staff sign-in, and does not promise a way to link that does not exist yet", () => {
    const staff = socialErrorMessage("staff_social_sign_in_not_allowed");
    expect(staff).toContain("Staff accounts can't sign in with Google or Apple");
    expect(staff).toContain("email and password");
    expect(socialErrorMessage("account_not_linked")).not.toMatch(/settings|Security/i);
  });

  it("returns null when no code is present", () => {
    expect(socialErrorMessage(null)).toBeNull();
    expect(socialErrorMessage("")).toBeNull();
  });

  it("falls back for unknown codes", () => {
    expect(socialErrorMessage("unknown_code")).toContain("Try again");
  });
});
