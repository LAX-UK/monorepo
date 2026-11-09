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
