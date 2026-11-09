import { describe, expect, it } from "vitest";
import { readProviderAddress } from "./provider-address.js";

function token(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;
}

describe("readProviderAddress", () => {
  it("reads the address Google reported, lower-cased", () => {
    expect(readProviderAddress(token({ email: "Ada@Example.com", email_verified: true }))).toEqual({
      email: "ada@example.com",
      hidden: false,
    });
  });

  it("marks Apple's private relay address as hidden, however Apple says so", () => {
    expect(
      readProviderAddress(token({ email: "abc@privaterelay.appleid.com", is_private_email: true })),
    ).toEqual({ email: "abc@privaterelay.appleid.com", hidden: true });
    expect(
      readProviderAddress(token({ email: "abc@example.com", is_private_email: "true" })),
    ).toEqual({ email: "abc@example.com", hidden: true });
    expect(readProviderAddress(token({ email: "ABC@PrivateRelay.AppleID.com" })).hidden).toBe(true);
  });

  it("does not mark an address hidden when there is none", () => {
    expect(readProviderAddress(token({ is_private_email: true }))).toEqual({
      email: null,
      hidden: false,
    });
  });

  it("is empty for a missing, malformed or oversized token", () => {
    const none = { email: null, hidden: false };
    expect(readProviderAddress(null)).toEqual(none);
    expect(readProviderAddress(undefined)).toEqual(none);
    expect(readProviderAddress("not-a-jwt")).toEqual(none);
    expect(readProviderAddress("a.%%%.c")).toEqual(none);
    expect(readProviderAddress(token({ email: `${"x".repeat(260)}@example.com` }))).toEqual(none);
    expect(readProviderAddress(token({ email: 42 }))).toEqual(none);
    expect(readProviderAddress(token({ email: "no-at-sign" }))).toEqual(none);
  });
});
