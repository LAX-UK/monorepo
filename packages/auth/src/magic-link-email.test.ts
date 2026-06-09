import { describe, expect, it } from "vitest";
import { pickMagicLinkTemplate } from "./magic-link-email.js";

describe("pickMagicLinkTemplate", () => {
  it("returns sign-in-link when the user already has a password", () => {
    expect(pickMagicLinkTemplate(true)).toBe("sign-in-link");
  });

  it("returns account-activation for passwordless users", () => {
    expect(pickMagicLinkTemplate(false)).toBe("account-activation");
  });
});
