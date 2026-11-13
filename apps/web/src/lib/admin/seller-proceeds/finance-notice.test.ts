import { describe, expect, it } from "vitest";
import {
  financeNoticeContent,
  financeNoticeCookieName,
  financeNoticeDismissCookie,
  showFinanceNotice,
} from "./finance-notice";

const DAY = 86_400_000;
const GO_LIVE = new Date("2026-11-13T00:00:00.000Z");

describe("finance notice", () => {
  it("shows until the person dismisses it", () => {
    expect(showFinanceNotice({ dismissed: false, now: new Date(GO_LIVE.getTime() + DAY) })).toBe(
      true,
    );
    expect(showFinanceNotice({ dismissed: true, now: new Date(GO_LIVE.getTime() + DAY) })).toBe(
      false,
    );
  });

  it("stops by itself after 30 days", () => {
    expect(
      showFinanceNotice({ dismissed: false, now: new Date(GO_LIVE.getTime() + 29 * DAY) }),
    ).toBe(true);
    expect(
      showFinanceNotice({ dismissed: false, now: new Date(GO_LIVE.getTime() + 30 * DAY) }),
    ).toBe(false);
  });

  it("is remembered per person, never longer than the notice runs", () => {
    expect(financeNoticeCookieName("user-a")).not.toBe(financeNoticeCookieName("user-b"));
    const cookie = financeNoticeDismissCookie("user-a", new Date(GO_LIVE.getTime() + 10 * DAY));
    expect(cookie).toContain(`${financeNoticeCookieName("user-a")}=1`);
    expect(cookie).toContain(`Max-Age=${20 * 86_400}`);
    expect(cookie).toContain("Path=/admin");
  });

  it("gives an example priced by the calculator", () => {
    const content = financeNoticeContent(new Date("2026-11-14T12:00:00Z"));
    expect(content.title).toBe("Seller payouts now follow each signed agreement.");
    expect(content.since).toBe("Since Fri 13 Nov. Payouts already paid haven't changed.");
    expect(content.sections.map((s) => s.heading)).toEqual([
      "What changed",
      "What you'll see",
      "For example",
    ]);
    expect(content.sections[2]?.body).toBe(
      "A lot sells for £6,200.00 under an agreement at 12%: commission £744.00, VAT on commission £148.80, and the seller receives £5,307.20.",
    );
  });
});
