import { describe, expect, it } from "vitest";
import { getClientMobileBottomTabs } from "./app-shell-nav";

describe("getClientMobileBottomTabs", () => {
  it("returns buying workspace tabs", () => {
    expect(getClientMobileBottomTabs("buying").map((item) => item.id)).toEqual([
      "overview",
      "bids",
      "watchlist",
      "notifications",
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
