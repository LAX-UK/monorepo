import { describe, expect, it } from "vitest";
import { readIdTokenIdentity, staffDisplayName } from "./staff-identity.vm";

function token(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(claims)}.signature`;
}

describe("readIdTokenIdentity", () => {
  it("reads the name and email claims", () => {
    expect(readIdTokenIdentity(token({ name: " Ada Lovelace ", email: "ada@lax.bid" }))).toEqual({
      name: "Ada Lovelace",
      email: "ada@lax.bid",
    });
  });

  it("returns nothing for a missing, malformed or claim-less token", () => {
    expect(readIdTokenIdentity(undefined)).toEqual({ name: null, email: null });
    expect(readIdTokenIdentity("not-a-jwt")).toEqual({ name: null, email: null });
    expect(readIdTokenIdentity("a.%%%.c")).toEqual({ name: null, email: null });
    expect(readIdTokenIdentity(token({ name: 4 }))).toEqual({ name: null, email: null });
  });
});

describe("staffDisplayName", () => {
  it("prefers the name, then the email, then the role", () => {
    expect(staffDisplayName({ name: "Ada", email: "a@x" }, "Finance")).toBe("Ada");
    expect(staffDisplayName({ name: null, email: "a@x" }, "Finance")).toBe("a@x");
    expect(staffDisplayName({ name: null, email: null }, "Finance")).toBe("Finance");
  });
});
