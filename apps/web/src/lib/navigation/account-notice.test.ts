import { describe, expect, it } from "vitest";
import { accountNoticeMessage, decodeAccountNotice, encodeAccountNotice } from "./account-notice";

const names = (id: string) =>
  id === "org-1" ? "Northbank Gallery" : id === "me" ? "Personal" : null;

describe("account notice", () => {
  it("round-trips through the cookie", () => {
    const notice = { kind: "removed", organisationName: "Northbank Gallery" } as const;
    expect(decodeAccountNotice(encodeAccountNotice(notice))).toEqual(notice);
  });

  it("ignores malformed cookies", () => {
    expect(decodeAccountNotice("not-json")).toBeNull();
    expect(decodeAccountNotice(encodeURIComponent('{"kind":"switched"}'))).toBeNull();
    expect(decodeAccountNotice(undefined)).toBeNull();
  });

  it("says which account a link switched to", () => {
    expect(accountNoticeMessage({ kind: "switched", accountId: "org-1" }, names)).toBe(
      "Switched to Northbank Gallery to show this.",
    );
  });

  it("says nothing when the account is unknown", () => {
    expect(accountNoticeMessage({ kind: "switched", accountId: "gone" }, names)).toBeNull();
  });

  it("explains a fallback after removal", () => {
    expect(
      accountNoticeMessage({ kind: "removed", organisationName: "Northbank Gallery" }, names),
    ).toBe("You're no longer a member of Northbank Gallery, so Bid opened your personal account.");
  });
});
