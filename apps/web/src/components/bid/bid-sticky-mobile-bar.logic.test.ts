import { describe, expect, it } from "vitest";
import {
  canShowBidCta,
  isSaleroomLifecycle,
  isTerminalLifecycle,
  saleroomStatusLine,
} from "./bid-sticky-mobile-bar.logic";

describe("bid-sticky-mobile-bar.logic", () => {
  it("detects saleroom lifecycle kinds", () => {
    expect(isSaleroomLifecycle("liveSaleroom")).toBe(true);
    expect(isSaleroomLifecycle("saleroomPaused")).toBe(true);
    expect(isSaleroomLifecycle("live")).toBe(false);
  });

  it("detects terminal lifecycle kinds", () => {
    expect(isTerminalLifecycle("endedSold")).toBe(true);
    expect(isTerminalLifecycle("liveSaleroom")).toBe(false);
  });

  it("returns saleroom status lines", () => {
    expect(saleroomStatusLine("saleroomPaused", false)).toBe("Auction paused");
    expect(saleroomStatusLine("liveSaleroom", true)).toBe("On the block");
    expect(saleroomStatusLine("liveSaleroom", false)).toBe("Live in saleroom");
  });

  it("blocks bid CTAs when policy blocks", () => {
    expect(canShowBidCta({ kind: "allow" })).toBe(true);
    expect(canShowBidCta({ kind: "block", viewId: "not-live:off-block", render: () => null })).toBe(
      false,
    );
  });
});
