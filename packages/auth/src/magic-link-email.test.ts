import { describe, expect, it } from "vitest";
import { pickMagicLinkTemplate } from "./magic-link-email.js";

describe("pickMagicLinkTemplate", () => {
  it("returns sign-in-link for established accounts (credential or social)", () => {
    expect(pickMagicLinkTemplate(true)).toBe("sign-in-link");
  });

  it("returns account-activation for truly account-less users", () => {
    expect(pickMagicLinkTemplate(false)).toBe("account-activation");
  });
});
