import {
  accountBadge,
  buildBidBottomTabs,
  signInThenReturn,
  watchingBadge,
} from "@/lib/navigation/bid-bottom-tabs";
import { NO_ATTENTION } from "@/lib/navigation/client-attention";
import { isTabCurrent } from "@auction/marketing-ui/bottom-bar/bottom-tab-config";
import { describe, expect, it } from "vitest";

const icons = { home: null, auctions: null, search: null, watching: null, account: null };
const tabs = (signedIn: boolean) => buildBidBottomTabs({ signedIn, attention: null, icons });
const currentKeys = (pathname: string) =>
  tabs(true)
    .filter((tab) => tab.href !== undefined && isTabCurrent(tab, pathname))
    .map((tab) => tab.key);

describe("Bid tab current matching", () => {
  it.each([
    ["/", ["home"]],
    ["/sales", ["auctions"]],
    ["/sales/2026-spring", ["auctions"]],
    ["/lot/estuary-at-dawn/abc-123", ["auctions"]],
    ["/watching", ["watching"]],
    ["/home", ["account"]],
    ["/artists", []],
    ["/search", []],
    ["/salesroom", []],
  ])("%s -> %j", (pathname, expected) => {
    expect(currentKeys(pathname)).toEqual(expected);
  });

  it("never marks Search current: it is a button that opens the search sheet", () => {
    const search = tabs(true).find((tab) => tab.key === "search");
    expect(search?.action).toBe("search");
    expect(search?.href).toBeUndefined();
  });
});

describe("Bid tab badges", () => {
  it("dots Watching only when outbid", () => {
    expect(watchingBadge(null)).toBeNull();
    expect(watchingBadge(NO_ATTENTION)).toBeNull();
    expect(watchingBadge({ ...NO_ATTENTION, outbidLots: [null] })).toEqual({ kind: "dot" });
  });

  it("dots Account for payment due, account in review or unread notifications", () => {
    expect(accountBadge(null)).toBeNull();
    expect(accountBadge(NO_ATTENTION)).toBeNull();
    expect(accountBadge({ ...NO_ATTENTION, outbidLots: ["1"] })).toBeNull();
    expect(accountBadge({ ...NO_ATTENTION, paymentsDue: 2 })).toEqual({ kind: "dot" });
    expect(accountBadge({ ...NO_ATTENTION, paymentsDue: 1, paymentsInReview: true })).toEqual({
      kind: "dot",
    });
    expect(accountBadge({ ...NO_ATTENTION, unreadNotifications: 1 })).toEqual({ kind: "dot" });
    expect(
      accountBadge({
        ...NO_ATTENTION,
        stillToSend: { count: 1, pence: 30_005, lotIds: ["lot-9"] },
      }),
    ).toEqual({ kind: "dot" });
  });

  it("wires the badges onto the right tabs, signed in only", () => {
    const attention = { ...NO_ATTENTION, outbidLots: ["3"], paymentsDue: 1 };
    const wired = buildBidBottomTabs({ signedIn: true, attention, icons });
    expect(wired.find((t) => t.key === "watching")?.badge).toEqual({ kind: "dot" });
    expect(wired.find((t) => t.key === "account")?.badge).toEqual({ kind: "dot" });
    expect(wired.find((t) => t.key === "home")?.badge).toBeUndefined();
    const guest = buildBidBottomTabs({ signedIn: false, attention, icons });
    expect(guest.find((t) => t.key === "watching")?.badge).toBeNull();
    expect(guest.find((t) => t.key === "account")?.badge).toBeNull();
  });
});

describe("Bid tabs for a signed-out visitor", () => {
  it("opens Sign in and returns to Watching and to the account", () => {
    const [, , , watching, account] = tabs(false);
    expect(watching?.href).toBe(signInThenReturn("/watching"));
    expect(watching?.href).toBe("/api/auth/login?next=%2Fwatching");
    expect(account?.href).toBe("/api/auth/login?next=%2Fhome");
    expect(watching?.prefetch).toBe(false);
    expect(account?.prefetch).toBe(false);
  });

  it("keeps Home and Auctions as plain pages", () => {
    const [home, auctions] = tabs(false);
    expect([home?.href, auctions?.href]).toEqual(["/", "/sales"]);
    expect(home?.prefetch).toBeUndefined();
  });

  it("links straight to the pages when signed in", () => {
    const [, , , watching, account] = tabs(true);
    expect([watching?.href, account?.href]).toEqual(["/watching", "/home"]);
  });
});
