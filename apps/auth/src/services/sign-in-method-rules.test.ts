import { describe, expect, it } from "vitest";
import {
  decideRemovePasskey,
  decideUnlink,
  describeSignInMethods,
  summariseSignInMethodKinds,
} from "./sign-in-method-rules.js";

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T09:00:00Z`);
const credential = { providerId: "credential", hasPassword: true, createdAt: at(1) };
const google = { providerId: "google", hasPassword: false, createdAt: at(2) };
const apple = { providerId: "apple", hasPassword: false, createdAt: at(3) };

describe("describeSignInMethods", () => {
  it("reports a password and the linked providers, oldest first", () => {
    expect(describeSignInMethods([apple, credential, google])).toEqual({
      hasPassword: true,
      social: [
        { provider: "google", linkedAt: at(2), providerEmail: null, hidden: false },
        { provider: "apple", linkedAt: at(3), providerEmail: null, hidden: false },
      ],
      passkeys: [],
    });
  });

  it("carries the address a provider reported and whether it is a private relay", () => {
    const relay = {
      ...apple,
      providerEmail: "relay@privaterelay.appleid.com",
      providerEmailHidden: true,
    };
    const own = { ...google, providerEmail: "ada@example.com", providerEmailHidden: false };
    expect(describeSignInMethods([relay, own]).social).toEqual([
      { provider: "google", linkedAt: at(2), providerEmail: "ada@example.com", hidden: false },
      {
        provider: "apple",
        linkedAt: at(3),
        providerEmail: "relay@privaterelay.appleid.com",
        hidden: true,
      },
    ]);
  });

  it("lists passkeys oldest first, beside the other methods", () => {
    const newer = {
      id: "pk-2",
      name: "Phone",
      deviceType: "multiDevice" as const,
      backedUp: true,
      transports: "internal",
      createdAt: at(9),
      lastUsedAt: null,
    };
    const older = { ...newer, id: "pk-1", name: "Laptop", createdAt: at(4) };
    expect(
      describeSignInMethods([credential], [newer, older]).passkeys.map((key) => key.id),
    ).toEqual(["pk-1", "pk-2"]);
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
    ).toEqual({ hasPassword: false, social: [], passkeys: [] });
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

  it("counts a passkey as a way in: the only provider may go when a passkey remains (SM7)", () => {
    expect(decideUnlink([google], "google", 1)).toBe("allowed");
    expect(decideUnlink([google, apple], "apple", 0)).toBe("allowed");
    expect(decideUnlink([google], "google", 0)).toBe("last_sign_in_method");
  });

  it("still counts only what the person set up, not the emailed link", () => {
    const empty = { providerId: "credential", hasPassword: false, createdAt: at(1) };
    expect(decideUnlink([empty, google], "google", 0)).toBe("last_sign_in_method");
    expect(decideUnlink([empty, google], "google", 2)).toBe("allowed");
  });
});

describe("decideRemovePasskey", () => {
  const row = (providerId: string, hasPassword = false) => ({
    providerId,
    hasPassword,
    createdAt: new Date("2026-10-01T09:00:00Z"),
  });

  it("refuses the only way to sign in", () => {
    expect(decideRemovePasskey([], 1)).toBe("last_sign_in_method");
  });

  it("allows it while a password, a provider or another passkey remains", () => {
    expect(decideRemovePasskey([row("credential", true)], 1)).toBe("allowed");
    expect(decideRemovePasskey([row("google")], 1)).toBe("allowed");
    expect(decideRemovePasskey([], 2)).toBe("allowed");
  });

  it("does not count a credential row with no password (an account made by a social sign-in)", () => {
    expect(decideRemovePasskey([row("credential", false)], 1)).toBe("last_sign_in_method");
  });

  it("does not count the emailed sign-in link, which is no method the person set up", () => {
    // Nothing in the account rows stands for the email link, so it can never save the last passkey.
    expect(decideRemovePasskey([row("magic-link")], 1)).toBe("last_sign_in_method");
  });
});

describe("summariseSignInMethodKinds", () => {
  const passkey = (id: string) => ({
    id,
    name: "Work laptop",
    deviceType: "multiDevice" as const,
    backedUp: true,
    transports: null,
    createdAt: at(4),
    lastUsedAt: null,
  });
  const methods = describeSignInMethods(
    [credential, { ...google, providerEmail: "person@gmail.com" }],
    [passkey("a"), passkey("b")],
  );

  it("reports kinds and a passkey count, and nothing that identifies a method", () => {
    const kinds = summariseSignInMethodKinds(methods, true);
    expect(kinds).toEqual({ password: true, google: true, apple: false, passkeys: 2 });
    expect(JSON.stringify(kinds)).not.toMatch(/gmail|Work laptop/);
  });

  it("says nothing about passkeys when they are not offered", () => {
    expect(summariseSignInMethodKinds(methods, false).passkeys).toBeNull();
  });

  it("reports an empty set as nothing linked and zero passkeys", () => {
    expect(summariseSignInMethodKinds(describeSignInMethods([]), true)).toEqual({
      password: false,
      google: false,
      apple: false,
      passkeys: 0,
    });
  });
});
