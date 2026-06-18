import {
  computeLotRunProgress,
  deriveLotRunOutcome,
  isLotAdvanceable,
} from "@/lib/saleroom/lot-run-progress";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

function lot(
  id: string,
  lotNumber: number,
  status: Lot["status"],
  winnerId: string | null = null,
): Lot {
  return {
    id,
    lotNumber,
    title: `Title ${id}`,
    status,
    winnerId,
    currentPrice: "100.00",
  } as Lot;
}

describe("deriveLotRunOutcome", () => {
  it("returns on_block when lot matches currentLotId", () => {
    const l = lot("l1", 1, "active");
    expect(deriveLotRunOutcome(l, "l1")).toBe("on_block");
  });

  it("returns sold for ended lot with winner", () => {
    const l = lot("l1", 1, "ended", "user-1");
    expect(deriveLotRunOutcome(l, null)).toBe("sold");
  });

  it("returns no_sale for ended lot without winner", () => {
    const l = lot("l1", 1, "ended", null);
    expect(deriveLotRunOutcome(l, null)).toBe("no_sale");
  });

  it("returns skipped for cancelled and voided", () => {
    expect(deriveLotRunOutcome(lot("l1", 1, "cancelled"), null)).toBe("skipped");
    expect(deriveLotRunOutcome(lot("l1", 1, "voided"), null)).toBe("skipped");
  });

  it("returns upcoming for active lot not on block", () => {
    expect(deriveLotRunOutcome(lot("l1", 1, "active"), "other")).toBe("upcoming");
  });
});

describe("computeLotRunProgress", () => {
  const lots = [
    lot("l1", 1, "ended", "u1"),
    lot("l2", 2, "ended", null),
    lot("l3", 3, "active"),
    lot("l4", 4, "scheduled"),
  ];

  it("shows Lot N of M when currentLotId is set", () => {
    const p = computeLotRunProgress(lots, "l3", "live");
    expect(p.currentIndex).toBe(2);
    expect(p.progressLabel).toBe("Lot 3 of 4");
    expect(p.completedLots).toBe(2);
    expect(p.remainingLots).toBe(2);
    expect(p.betweenLots).toBe(false);
  });

  it("shows between lots when live and currentLotId is null", () => {
    const p = computeLotRunProgress(lots, null, "live");
    expect(p.betweenLots).toBe(true);
    expect(p.progressLabel).toBe("Between lots — advance next");
    expect(p.currentIndex).toBeNull();
    expect(p.sessionStatusLabel).toBe("Between lots");
  });

  it("does not show Lot 0 of M when between lots", () => {
    const p = computeLotRunProgress(lots, null, "live");
    expect(p.progressLabel).not.toMatch(/Lot 0/);
  });

  it("handles paused session", () => {
    const p = computeLotRunProgress(lots, "l3", "paused");
    expect(p.sessionStatusLabel).toBe("Paused");
    expect(p.progressLabel).toBe("Lot 3 of 4");
  });

  it("handles empty lot list", () => {
    const p = computeLotRunProgress([], null, "live");
    expect(p.progressLabel).toBe("No lots");
    expect(p.totalLots).toBe(0);
  });
});

describe("isLotAdvanceable", () => {
  it("includes active and scheduled lots only", () => {
    expect(isLotAdvanceable(lot("l1", 1, "active"))).toBe(true);
    expect(isLotAdvanceable(lot("l1", 1, "scheduled"))).toBe(true);
    expect(isLotAdvanceable(lot("l1", 1, "draft"))).toBe(false);
    expect(isLotAdvanceable(lot("l1", 1, "ended"))).toBe(false);
    expect(isLotAdvanceable(lot("l1", 1, "cancelled"))).toBe(false);
    expect(isLotAdvanceable(lot("l1", 1, "voided"))).toBe(false);
  });
});
