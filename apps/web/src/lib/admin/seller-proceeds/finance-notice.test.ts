import { describe, expect, it } from "vitest";
import {
  financeNoticeContent,
  financeNoticeCookieName,
  financeNoticeDismissCookie,
  sellerRuleGoLive,
  showFinanceNotice,
} from "./finance-notice";

const DAY = 86_400_000;
const GO_LIVE = new Date("2026-11-16T06:00:00.000Z");
const at = (days: number) => new Date(GO_LIVE.getTime() + days * DAY);

describe("finance notice", () => {
  it("shows until the person dismisses it", () => {
    expect(showFinanceNotice({ dismissed: false, goLive: GO_LIVE, now: at(1) })).toBe(true);
    expect(showFinanceNotice({ dismissed: true, goLive: GO_LIVE, now: at(1) })).toBe(false);
  });

  it("stops by itself after 30 days", () => {
    expect(showFinanceNotice({ dismissed: false, goLive: GO_LIVE, now: at(29) })).toBe(true);
    expect(showFinanceNotice({ dismissed: false, goLive: GO_LIVE, now: at(30) })).toBe(false);
  });

  it("starts on the configured go-live, not on the day the code merged", () => {
    expect(showFinanceNotice({ dismissed: false, goLive: GO_LIVE, now: at(-1) })).toBe(false);
    expect(showFinanceNotice({ dismissed: false, goLive: null, now: at(1) })).toBe(false);
  });

  it("reads the go-live from the deploy's configuration, and nothing it cannot read", () => {
    expect(sellerRuleGoLive({ SELLER_RULE_GO_LIVE_AT: "2026-11-16T06:00:00.000Z" })).toEqual(
      GO_LIVE,
    );
    expect(sellerRuleGoLive({})).toBeNull();
    expect(sellerRuleGoLive({ SELLER_RULE_GO_LIVE_AT: "" })).toBeNull();
    expect(sellerRuleGoLive({ SELLER_RULE_GO_LIVE_AT: "soon" })).toBeNull();
    expect(sellerRuleGoLive({ SELLER_RULE_GO_LIVE_AT: "2026-13-45T00:00:00Z" })).toBeNull();
  });

  it("is remembered per person over HTTPS only, never longer than the notice runs", () => {
    expect(financeNoticeCookieName("user-a")).not.toBe(financeNoticeCookieName("user-b"));
    const cookie = financeNoticeDismissCookie("user-a", GO_LIVE, at(10));
    expect(cookie).toContain(`${financeNoticeCookieName("user-a")}=1`);
    expect(cookie).toContain(`Max-Age=${20 * 86_400}`);
    expect(cookie).toContain("Path=/admin");
    expect(cookie.split("; ")).toContain("Secure");
  });

  it("gives the configured date and an example priced by the calculator", () => {
    const content = financeNoticeContent(GO_LIVE, at(1));
    expect(content.title).toBe("Seller payouts now follow each signed agreement.");
    expect(content.since).toBe("Since Mon 16 Nov. Payouts already paid haven't changed.");
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
