import { describe, expect, it } from "vitest";
import {
  accountNoticeDetail,
  accountNoticeMessage,
  decodeAccountNotice,
  encodeAccountNotice,
  noticeBelongsToAccount,
  notificationSwitchToast,
} from "./account-notice";

const names = (id: string) =>
  id === "org-1"
    ? { kind: "organisation" as const, name: "Northbank Gallery" }
    : id === "me"
      ? { kind: "personal" as const, name: "Personal" }
      : null;

describe("account notice", () => {
  it("round-trips through the cookie", () => {
    const notice = { kind: "removed", organisationName: "Northbank Gallery" } as const;
    expect(decodeAccountNotice(encodeAccountNotice(notice))).toEqual(notice);
  });

  it("keeps the account a record link came from, when there was one", () => {
    const notice = { kind: "switched", accountId: "org-1", fromAccountId: "me" } as const;
    expect(decodeAccountNotice(encodeAccountNotice(notice))).toEqual(notice);
    const record = { ...notice, record: true } as const;
    expect(decodeAccountNotice(encodeAccountNotice(record))).toEqual(record);
    expect(
      decodeAccountNotice(encodeAccountNotice({ kind: "switched", accountId: "org-1" })),
    ).toEqual({ kind: "switched", accountId: "org-1" });
  });

  it("ignores malformed cookies", () => {
    expect(decodeAccountNotice("not-json")).toBeNull();
    expect(decodeAccountNotice(encodeURIComponent('{"kind":"switched"}'))).toBeNull();
    expect(decodeAccountNotice(undefined)).toBeNull();
  });

  it("says which account a link switched to", () => {
    expect(
      accountNoticeMessage({ kind: "switched", accountId: "org-1", record: true }, names),
    ).toBe("Switched to Northbank Gallery to show this.");
    // A link that is not a record's has nothing to show.
    expect(accountNoticeMessage({ kind: "switched", accountId: "org-1" }, names)).toBe(
      "Now acting as Northbank Gallery",
    );
  });

  it("says nothing when the account is unknown", () => {
    expect(accountNoticeMessage({ kind: "switched", accountId: "gone" }, names)).toBeNull();
  });

  it("says when this tab followed a switch made in another tab", () => {
    const notice = { kind: "switched_elsewhere", accountId: "org-1" } as const;
    expect(decodeAccountNotice(encodeAccountNotice(notice))).toEqual(notice);
    expect(accountNoticeMessage(notice, names)).toBe(
      "You switched to Northbank Gallery in another tab, so this tab shows it now.",
    );
  });

  it("turns an opened notification into a toast with the way back", () => {
    const notice = {
      kind: "opened_notification",
      accountId: "org-1",
      fromAccountId: "me",
    } as const;
    expect(decodeAccountNotice(encodeAccountNotice(notice))).toEqual(notice);
    const accounts = {
      "org-1": { kind: "organisation" as const, name: "Cedar & Stone Fine Art", initials: "CS" },
      me: { kind: "personal" as const, name: "Personal", initials: "MO" },
    };
    const accountOf = (id: string) => accounts[id as keyof typeof accounts] ?? null;
    expect(notificationSwitchToast(notice, accountOf)).toEqual({
      account: { kind: "organisation", name: "Cedar & Stone Fine Art", initials: "CS" },
      fromAccountId: "me",
      fromKind: "personal",
    });
    expect(notificationSwitchToast({ ...notice, fromAccountId: "gone" }, accountOf)).toBeNull();
  });

  it("ignores notices of a kind it does not know", () => {
    expect(decodeAccountNotice(encodeURIComponent('{"kind":"toString"}'))).toBeNull();
    expect(decodeAccountNotice(encodeURIComponent('{"kind":"other","accountId":"x"}'))).toBeNull();
  });

  it("explains a fallback after removal", () => {
    expect(
      accountNoticeMessage({ kind: "removed", organisationName: "Northbank Gallery" }, names),
    ).toBe("You're no longer a member of Northbank Gallery, so Bid opened your personal account.");
  });

  describe("a switch the person chose", () => {
    const org = { kind: "chose", accountId: "org-1" } as const;

    it("round-trips through the cookie, carrying only the id", () => {
      expect(decodeAccountNotice(encodeAccountNotice(org))).toEqual(org);
      expect(decodeAccountNotice(encodeURIComponent('{"kind":"chose"}'))).toBeNull();
    });

    it("ignores a name placed in the cookie", () => {
      const forged = encodeURIComponent(
        '{"kind":"chose","accountId":"org-1","accountName":"Evil Ltd","accountKind":"organisation"}',
      );
      expect(decodeAccountNotice(forged)).toEqual(org);
      expect(accountNoticeMessage(decodeAccountNotice(forged), names)).toBe(
        "Now acting as Northbank Gallery",
      );
    });

    it("says who they act as in an organisation, from the account list", () => {
      expect(accountNoticeMessage(org, names)).toBe("Now acting as Northbank Gallery");
      expect(accountNoticeDetail(org, names)).toBe(
        "Bids, purchases and consignments here are the organisation's.",
      );
    });

    it("says they use their personal account", () => {
      const personal = { kind: "chose", accountId: "me" } as const;
      expect(accountNoticeMessage(personal, names)).toBe("Now using your personal account");
      expect(accountNoticeDetail(personal, names)).toBe("Your own bids and purchases.");
    });

    it("says nothing for an account that is not in the list", () => {
      expect(accountNoticeMessage({ kind: "chose", accountId: "gone" }, names)).toBeNull();
    });
  });

  describe("noticeBelongsToAccount", () => {
    it("is true only for the account the notice names", () => {
      expect(noticeBelongsToAccount({ kind: "switched", accountId: "org-1" }, "org-1")).toBe(true);
      expect(noticeBelongsToAccount({ kind: "switched", accountId: "org-1" }, "me")).toBe(false);
      expect(noticeBelongsToAccount({ kind: "switched_elsewhere", accountId: "x" }, "me")).toBe(
        false,
      );
    });

    it("keeps the removal notice, which names no account in use", () => {
      expect(noticeBelongsToAccount({ kind: "removed", organisationName: "N" }, "me")).toBe(true);
      expect(noticeBelongsToAccount(null, "me")).toBe(false);
    });
  });
});
