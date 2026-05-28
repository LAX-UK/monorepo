import { describe, expect, it } from "vitest";
import { getClientBuyingNavItems, getClientMobileBottomTabs } from "./app-shell-nav";

describe("getClientMobileBottomTabs", () => {
  it("returns buying workspace tabs", () => {
    expect(getClientMobileBottomTabs("buying").map((item) => item.id)).toEqual([
      "overview",
      "bids",
      "watchlist",
      "portfolio",
      "more",
    ]);
  });

  it("returns selling workspace tabs", () => {
    expect(getClientMobileBottomTabs("selling").map((item) => item.id)).toEqual([
      "seller-overview",
      "submissions",
      "in-sale",
      "notifications",
      "more",
    ]);
  });
});

describe("org module nav filtering", () => {
  it("hides organisations and invitations when org module disabled", () => {
    const ids = getClientBuyingNavItems(false).map((item) => item.id);
    expect(ids).not.toContain("organisations");
    expect(ids).not.toContain("invitations");
    expect(ids).toContain("overview");
  });
});
