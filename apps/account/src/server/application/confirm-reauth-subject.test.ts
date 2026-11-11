import { describe, expect, it } from "vitest";
import { assertReauthSubject } from "./confirm-reauth-subject";
import type { PendingAccountLogin } from "./start-account-login";

const base: PendingAccountLogin = { state: "s", nonce: "n", codeVerifier: "v", returnTo: "/" };

describe("assertReauthSubject", () => {
  it("accepts a step-up completed by the person who asked for it", () => {
    expect(() =>
      assertReauthSubject({ ...base, reauth: true, reauthSubject: "user-a" }, "user-a"),
    ).not.toThrow();
  });

  it("refuses a step-up completed as a different person, such as another person's passkey", () => {
    expect(() =>
      assertReauthSubject({ ...base, reauth: true, reauthSubject: "user-a" }, "user-b"),
    ).toThrow(/did not|not completed/i);
  });

  it("refuses a step-up that does not say who asked", () => {
    expect(() => assertReauthSubject({ ...base, reauth: true }, "user-a")).toThrow();
  });

  it("leaves an ordinary sign-in alone", () => {
    expect(() => assertReauthSubject(base, "anyone")).not.toThrow();
  });
});
