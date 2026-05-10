import { describe, expect, it } from "vitest";
import { PERSONAL_EMAIL_DOMAINS, isPersonalDomain } from "./personal-email-domains";

describe("isPersonalDomain", () => {
  it("returns true for each known personal domain", () => {
    for (const domain of PERSONAL_EMAIL_DOMAINS) {
      expect(isPersonalDomain(`alice@${domain}`)).toBe(true);
    }
  });

  it("is case-insensitive on the domain part", () => {
    expect(isPersonalDomain("Alice@Gmail.COM")).toBe(true);
    expect(isPersonalDomain("BOB@PROTONMAIL.com")).toBe(true);
  });

  it("returns false for typical work / custom domains", () => {
    expect(isPersonalDomain("alice@acme.gallery")).toBe(false);
    expect(isPersonalDomain("bob@thelax.bid")).toBe(false);
    expect(isPersonalDomain("carol@dealer.co.uk")).toBe(false);
  });

  it("returns false for malformed inputs without breaking", () => {
    expect(isPersonalDomain("")).toBe(false);
    expect(isPersonalDomain("not-an-email")).toBe(false);
    expect(isPersonalDomain("trailing-at@")).toBe(false);
    expect(isPersonalDomain("@gmail.com")).toBe(true); // domain-only is still a personal domain
  });
});
