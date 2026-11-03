import { describe, expect, it } from "vitest";
import { decideUnlink, describeSignInMethods } from "./sign-in-method-rules.js";

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T09:00:00Z`);
const credential = { providerId: "credential", hasPassword: true, createdAt: at(1) };
const google = { providerId: "google", hasPassword: false, createdAt: at(2) };
const apple = { providerId: "apple", hasPassword: false, createdAt: at(3) };

describe("describeSignInMethods", () => {
  it("reports a password and the linked providers, oldest first", () => {
    expect(describeSignInMethods([apple, credential, google])).toEqual({
      hasPassword: true,
      social: [
        { provider: "google", linkedAt: at(2) },
        { provider: "apple", linkedAt: at(3) },
      ],
    });
  });

  it("does not count a credential row that has no password", () => {
    expect(
      describeSignInMethods([{ providerId: "credential", hasPassword: false, createdAt: at(1) }])
        .hasPassword,
    ).toBe(false);
  });

  it("ignores providers that are not offered for linking", () => {
    expect(
      describeSignInMethods([{ providerId: "github", hasPassword: false, createdAt: at(1) }]),
    ).toEqual({ hasPassword: false, social: [] });
  });
});

describe("decideUnlink (last-method guard)", () => {
  it("allows removing a provider when a password remains", () => {
    expect(decideUnlink([credential, google], "google")).toBe("allowed");
  });

  it("allows removing one provider when another remains", () => {
    expect(decideUnlink([google, apple], "apple")).toBe("allowed");
  });

  it("refuses removing the only provider on a social-only account", () => {
    expect(decideUnlink([google], "google")).toBe("last_sign_in_method");
  });

  it("refuses when the only other method is a credential row without a password", () => {
    const empty = { providerId: "credential", hasPassword: false, createdAt: at(1) };
    expect(decideUnlink([empty, google], "google")).toBe("last_sign_in_method");
  });

  it("says not linked for a provider the account does not have", () => {
    expect(decideUnlink([credential, google], "apple")).toBe("not_linked");
  });
});
