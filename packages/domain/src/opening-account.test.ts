import { describe, expect, it } from "vitest";
import { type UsableAccount, canUseAccount, decideOpeningAccount } from "./opening-account.js";

const personal: UsableAccount = { id: "me", kind: "individual" };
const gallery: UsableAccount = { id: "northbank", kind: "organisation" };

describe("decideOpeningAccount", () => {
  it("opens the personal account when nothing is remembered", () => {
    expect(
      decideOpeningAccount({
        candidateId: null,
        accounts: [personal, gallery],
        organisationsEnabled: true,
      }),
    ).toEqual({ kind: "use", accountId: "me" });
  });

  it("restores the organisation the person used last", () => {
    expect(
      decideOpeningAccount({
        candidateId: "northbank",
        accounts: [personal, gallery],
        organisationsEnabled: true,
      }),
    ).toEqual({ kind: "use", accountId: "northbank" });
  });

  it("falls back to personal and names the organisation after the person is removed", () => {
    expect(
      decideOpeningAccount({
        candidateId: "northbank",
        accounts: [personal],
        organisationsEnabled: true,
      }),
    ).toEqual({ kind: "fallback", accountId: "me", lostAccountId: "northbank" });
  });

  it("falls back to personal while organisations are switched off", () => {
    expect(
      decideOpeningAccount({
        candidateId: "northbank",
        accounts: [personal, gallery],
        organisationsEnabled: false,
      }),
    ).toEqual({ kind: "fallback", accountId: "me", lostAccountId: "northbank" });
  });

  it("has nothing to open without a personal account", () => {
    expect(
      decideOpeningAccount({ candidateId: null, accounts: [gallery], organisationsEnabled: true }),
    ).toEqual({ kind: "none" });
  });
});

describe("canUseAccount", () => {
  it("accepts the person's own accounts", () => {
    expect(canUseAccount("me", [personal, gallery], true)).toBe(true);
    expect(canUseAccount("northbank", [personal, gallery], true)).toBe(true);
  });

  it("refuses an organisation the person does not belong to", () => {
    expect(canUseAccount("elsewhere", [personal, gallery], true)).toBe(false);
  });

  it("refuses organisations while they are switched off", () => {
    expect(canUseAccount("northbank", [personal, gallery], false)).toBe(false);
  });
});
