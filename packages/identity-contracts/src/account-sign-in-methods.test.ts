import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ACTION_DONE_PATH,
  ACCOUNT_ACTION_PATH,
  ACCOUNT_ACTION_TICKET_TTL_SECONDS,
  ACCOUNT_SIGN_IN_METHODS_INTENT_PATH,
  ACCOUNT_SIGN_IN_METHODS_PASSKEY_REMOVE_PATH,
  ACCOUNT_SIGN_IN_METHODS_PASSKEY_RENAME_PATH,
  ACCOUNT_SIGN_IN_METHODS_PATH,
  ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH,
  ACCOUNT_SIGN_IN_METHOD_ERRORS,
  ACCOUNT_SIGN_IN_METHOD_RETURNS,
  ACCOUNT_SIGN_IN_METHOD_RETURN_CODES,
  ACCOUNT_SIGN_IN_METHOD_RETURN_ERRORS,
  ACCOUNT_SIGN_IN_METHOD_RETURN_PARAM,
  PASSKEY_LIMIT,
  PASSKEY_NAME_INPUT_MAX_LENGTH,
  SESSION_SIGN_IN_METHODS,
  SIGN_IN_METHOD_KINDS,
  accountActionIntentSchema,
  accountPasskeySchema,
  accountSignInMethodsSchema,
  isValidPasskeyName,
  socialSignInProviderSchema,
} from "./account-sign-in-methods.js";

const LINKED = { provider: "google", linkedAt: "2026-10-01T09:00:00Z" } as const;

describe("account sign-in methods contract", () => {
  it("lives under the issuer's lax account routes", () => {
    expect(ACCOUNT_SIGN_IN_METHODS_PATH).toBe("/lax/account-sign-in-methods");
    expect(ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH).toBe("/lax/account-sign-in-methods/unlink");
    expect(ACCOUNT_SIGN_IN_METHODS_INTENT_PATH).toBe("/lax/account-sign-in-methods/intent");
    expect(ACCOUNT_SIGN_IN_METHODS_PASSKEY_RENAME_PATH).toBe(
      "/lax/account-sign-in-methods/passkeys/rename",
    );
    expect(ACCOUNT_SIGN_IN_METHODS_PASSKEY_REMOVE_PATH).toBe(
      "/lax/account-sign-in-methods/passkeys/remove",
    );
  });

  it("names only Google and Apple as providers, and adds the passkey as a method", () => {
    expect(socialSignInProviderSchema.safeParse("google").success).toBe(true);
    expect(socialSignInProviderSchema.safeParse("apple").success).toBe(true);
    expect(socialSignInProviderSchema.safeParse("credential").success).toBe(false);
    expect(SIGN_IN_METHOD_KINDS).toEqual(["google", "apple", "passkey"]);
  });

  it("strips the provider's own identifier and every other extra field", () => {
    const parsed = accountSignInMethodsSchema.parse({
      hasPassword: false,
      social: [{ ...LINKED, accountId: "1234", accessToken: "secret" }],
    });
    expect(Object.keys(parsed.social[0] ?? {}).sort()).toEqual([
      "hidden",
      "linkedAt",
      "provider",
      "providerEmail",
    ]);
  });

  it("reads a response from an older issuer: the version 2 fields take their defaults", () => {
    const parsed = accountSignInMethodsSchema.parse({ hasPassword: true, social: [LINKED] });
    expect(parsed.social[0]).toEqual({ ...LINKED, providerEmail: null, hidden: false });
    expect(parsed.passkeys).toEqual([]);
    expect(parsed.available).toEqual({ google: false, apple: false, passkey: false });
  });

  it("carries the address a provider reported and whether it is a private relay", () => {
    const parsed = accountSignInMethodsSchema.parse({
      hasPassword: false,
      social: [{ ...LINKED, providerEmail: "relay@privaterelay.appleid.com", hidden: true }],
    });
    expect(parsed.social[0]).toMatchObject({
      providerEmail: "relay@privaterelay.appleid.com",
      hidden: true,
    });
  });

  it("describes a passkey by name, kind and dates, and drops its key material", () => {
    const parsed = accountPasskeySchema.parse({
      id: "pk-1",
      name: "Sarah's MacBook",
      synced: true,
      kind: "platform",
      createdAt: "2026-10-01T09:00:00Z",
      lastUsedAt: null,
      publicKey: "LEAK",
      credentialId: "LEAK",
      counter: 7,
    });
    expect(Object.keys(parsed).sort()).toEqual([
      "createdAt",
      "id",
      "kind",
      "lastUsedAt",
      "name",
      "synced",
    ]);
    expect(accountPasskeySchema.safeParse({ ...parsed, name: "" }).success).toBe(false);
    expect(accountPasskeySchema.safeParse({ ...parsed, name: "x".repeat(61) }).success).toBe(false);
    expect(accountPasskeySchema.safeParse({ ...parsed, kind: "phone" }).success).toBe(false);
  });

  it("allows ten passkeys", () => {
    expect(PASSKEY_LIMIT).toBe(10);
  });

  it("records a session as signed in with a password, a provider, a passkey or a link", () => {
    expect(SESSION_SIGN_IN_METHODS).toEqual(["password", "provider", "passkey", "link"]);
  });

  it("sends the browser to the issuer's action pages and keeps the ticket short-lived", () => {
    expect(ACCOUNT_ACTION_PATH).toBe("/account-action");
    expect(ACCOUNT_ACTION_DONE_PATH).toBe("/account-action/done");
    expect(ACCOUNT_ACTION_TICKET_TTL_SECONDS).toBe(120);
    expect(
      accountActionIntentSchema.safeParse({ url: "https://auth.lax.bid/account-action?t=1" })
        .success,
    ).toBe(true);
    expect(accountActionIntentSchema.safeParse({ url: "not a url" }).success).toBe(false);
  });

  it("returns to Security with one fixed word, drawn from a single list with no repeats", () => {
    expect(ACCOUNT_SIGN_IN_METHOD_RETURN_PARAM).toBe("signInMethod");
    expect(new Set(ACCOUNT_SIGN_IN_METHOD_RETURNS).size).toBe(
      ACCOUNT_SIGN_IN_METHOD_RETURNS.length,
    );
  });

  it("lists each refusal once, including the new ones", () => {
    expect(new Set(ACCOUNT_SIGN_IN_METHOD_ERRORS).size).toBe(ACCOUNT_SIGN_IN_METHOD_ERRORS.length);
    expect(ACCOUNT_SIGN_IN_METHOD_ERRORS).toEqual(
      expect.arrayContaining(["passkey_limit", "not_available", "staff_not_allowed"]),
    );
  });

  it("returns the person to Account with fixed words only", () => {
    expect(ACCOUNT_SIGN_IN_METHOD_RETURN_CODES).toEqual([
      "google_linked",
      "apple_linked",
      "passkey_added",
    ]);
    expect(ACCOUNT_SIGN_IN_METHOD_RETURN_ERRORS).toEqual(
      expect.arrayContaining([
        "cancelled",
        "already_linked_elsewhere",
        "provider_unavailable",
        "expired",
        "reauth_required",
        "rate_limited",
      ]),
    );
  });
});

describe("isValidPasskeyName", () => {
  it("accepts a short line of ordinary text, accented and non-Latin letters and emoji included", () => {
    for (const name of [
      "Work laptop",
      "  iCloud Keychain  ",
      "Portable de José",
      "我的笔记本",
      "Phone 📱",
    ]) {
      expect(isValidPasskeyName(name)).toBe(true);
    }
    expect(isValidPasskeyName("x".repeat(PASSKEY_NAME_INPUT_MAX_LENGTH))).toBe(true);
  });

  it("refuses an empty name, spaces only, and one over the limit", () => {
    expect(isValidPasskeyName("")).toBe(false);
    expect(isValidPasskeyName("    ")).toBe(false);
    expect(isValidPasskeyName("x".repeat(PASSKEY_NAME_INPUT_MAX_LENGTH + 1))).toBe(false);
  });

  it.each([
    ["a newline", "one\ntwo"],
    ["a carriage return", "one\rtwo"],
    ["a tab", "one\ttwo"],
    ["a null", "one\u0000two"],
    ["a zero-width space", "one\u200Btwo"],
    ["a zero-width joiner", "one\u200Dtwo"],
    ["a left-to-right mark", "one\u200Etwo"],
    ["a right-to-left override", "one\u202Etwo"],
    ["a bidi isolate", "one\u2066two"],
    ["a byte order mark", "one\uFEFFtwo"],
    ["a soft hyphen", "one\u00ADtwo"],
    ["a line separator", "one\u2028two"],
    ["a paragraph separator", "one\u2029two"],
  ])(
    "refuses a name with %s, which could hide or reorder what is shown around it",
    (_label, name) => {
      expect(isValidPasskeyName(name)).toBe(false);
    },
  );
});
