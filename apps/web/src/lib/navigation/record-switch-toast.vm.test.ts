import { describe, expect, it } from "vitest";
import { recordSwitchToast } from "./record-switch-toast.vm";

const accounts = {
  me: { kind: "personal", name: "Personal", initials: "OG" },
  org: { kind: "organisation", name: "Northbank Gallery", initials: "NG" },
} as const;
const accountOf = (id: string) => accounts[id as keyof typeof accounts] ?? null;

describe("recordSwitchToast", () => {
  it("says the record opened in the organisation and offers the way back to Personal", () => {
    expect(
      recordSwitchToast({ kind: "switched", accountId: "org", fromAccountId: "me" }, accountOf),
    ).toEqual({
      account: accounts.org,
      title: "Opened in Northbank Gallery",
      detail: "This record belongs to the organisation.",
      backLabel: "Back to Personal",
      fromKind: "personal",
      fromAccountId: "me",
    });
  });

  it("names the organisation to go back to, and the personal account it opened in", () => {
    expect(
      recordSwitchToast({ kind: "switched", accountId: "me", fromAccountId: "org" }, accountOf),
    ).toMatchObject({
      title: "Opened in your personal account",
      detail: "This record belongs to your personal account.",
      backLabel: "Back to Northbank Gallery",
      fromKind: "organisation",
    });
  });

  it("has no toast without an account to go back to, or when one is no longer usable", () => {
    expect(recordSwitchToast({ kind: "switched", accountId: "org" }, accountOf)).toBeNull();
    expect(
      recordSwitchToast({ kind: "switched", accountId: "org", fromAccountId: "gone" }, accountOf),
    ).toBeNull();
    expect(
      recordSwitchToast({ kind: "switched", accountId: "gone", fromAccountId: "me" }, accountOf),
    ).toBeNull();
  });
});
