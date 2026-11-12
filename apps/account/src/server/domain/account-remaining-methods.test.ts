import { describe, expect, it } from "vitest";
import { describeRemainingMethods } from "./account-remaining-methods";

describe("describeRemainingMethods", () => {
  it("lists the password, the passkeys and the providers that are left", () => {
    expect(
      describeRemainingMethods({ hasPassword: true, passkeys: 2, providers: ["Google"] }),
    ).toBe("your password, your passkeys or Google");
  });

  it("names a single way in without a joining word", () => {
    expect(describeRemainingMethods({ hasPassword: true, passkeys: 0, providers: [] })).toBe(
      "your password",
    );
    expect(describeRemainingMethods({ hasPassword: false, passkeys: 1, providers: [] })).toBe(
      "your passkey",
    );
  });

  it("calls the passkeys that are left 'other' when a passkey is the one going", () => {
    expect(
      describeRemainingMethods(
        { hasPassword: true, passkeys: 1, providers: ["Google"] },
        { otherPasskeys: true },
      ),
    ).toBe("your password, your other passkey or Google");
    expect(
      describeRemainingMethods(
        { hasPassword: false, passkeys: 3, providers: [] },
        { otherPasskeys: true },
      ),
    ).toBe("your other passkeys");
  });

  it("is null when nothing is left", () => {
    expect(describeRemainingMethods({ hasPassword: false, passkeys: 0, providers: [] })).toBeNull();
  });
});
