import { resolveCatalogLotOverlay } from "@/lib/lot/catalog-lot-overlay";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

const hour = 60 * 60 * 1000;

function lotBase(status: Lot["status"], over: Partial<Lot> = {}): Lot {
  const t = Date.now();
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    sellerLegalEntityId: "le-1",
    title: "Test lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date(t - hour),
    endTime: new Date(t + hour),
    status,
    winnerId: null,
    createdAt: new Date(t),
    updatedAt: new Date(t),
    marketingDetails: {},
    ...over,
  } as Lot;
}

const hybridSale = {
  status: "active" as const,
  deliveryMode: "hybrid" as const,
  allowOnlineBidsBeforeGoLive: true,
};

describe("resolveCatalogLotOverlay", () => {
  it("hides overlay for on-block lot under live saleroom past endTime", () => {
    const t = Date.now();
    const lot = lotBase("active", {
      startTime: new Date(t - 2 * hour),
      endTime: new Date(t - hour),
    });
    const vm = resolveCatalogLotOverlay({
      lot,
      sale: hybridSale,
      nowMs: t,
      saleroomSessionActive: true,
      isOnBlock: true,
    });
    expect(vm).toEqual({ kind: "hidden" });
  });

  it("shows In saleroom for active off-block lot past endTime with live session", () => {
    const t = Date.now();
    const lot = lotBase("active", {
      startTime: new Date(t - 2 * hour),
      endTime: new Date(t - hour),
    });
    const vm = resolveCatalogLotOverlay({
      lot,
      sale: hybridSale,
      nowMs: t,
      saleroomSessionActive: true,
      isOnBlock: false,
    });
    expect(vm).toEqual({ kind: "saleroom", label: "In saleroom", tone: "muted" });
  });

  it("shows Up next for off-block lot flagged as up next", () => {
    const t = Date.now();
    const lot = lotBase("active", {
      startTime: new Date(t - 2 * hour),
      endTime: new Date(t - hour),
    });
    const vm = resolveCatalogLotOverlay({
      lot,
      sale: hybridSale,
      nowMs: t,
      saleroomSessionActive: true,
      isOnBlock: false,
      isUpNext: true,
    });
    expect(vm).toEqual({ kind: "saleroom", label: "Up next", tone: "live" });
  });

  it("shows Paused when session is paused", () => {
    const t = Date.now();
    const lot = lotBase("active", {
      startTime: new Date(t - 2 * hour),
      endTime: new Date(t - hour),
    });
    const vm = resolveCatalogLotOverlay({
      lot,
      sale: hybridSale,
      nowMs: t,
      saleroomSessionPaused: true,
    });
    expect(vm).toEqual({ kind: "saleroom", label: "Paused", tone: "muted" });
  });

  it("shows timer for live lot within catalog window", () => {
    const t = Date.now();
    const lot = lotBase("active", {
      startTime: new Date(t - hour),
      endTime: new Date(t + hour),
    });
    const vm = resolveCatalogLotOverlay({
      lot,
      sale: hybridSale,
      nowMs: t,
    });
    expect(vm.kind).toBe("timer");
    if (vm.kind === "timer") {
      expect(vm.timerState.kind).toBe("live");
      expect(vm.msLeft).toBeGreaterThan(0);
    }
  });

  it("shows status for ended lot with winner", () => {
    const lot = lotBase("ended", { winnerId: "u1" });
    const vm = resolveCatalogLotOverlay({
      lot,
      sale: hybridSale,
      nowMs: Date.now(),
    });
    expect(vm.kind).toBe("status");
    if (vm.kind === "status") {
      expect(vm.presentation.label).toBe("Sold");
    }
  });

  it("shows Unsold status when past endTime with no session", () => {
    const t = Date.now();
    const lot = lotBase("active", {
      startTime: new Date(t - 2 * hour),
      endTime: new Date(t - hour),
    });
    const vm = resolveCatalogLotOverlay({
      lot,
      sale: hybridSale,
      nowMs: t,
    });
    expect(vm.kind).toBe("status");
    if (vm.kind === "status") {
      expect(vm.presentation.label).toBe("Unsold");
    }
  });

  it("shows In saleroom for scheduled queue lot past endTime with live session", () => {
    const t = Date.now();
    const lot = lotBase("scheduled", {
      startTime: new Date(t - 2 * hour),
      endTime: new Date(t - hour),
    });
    const vm = resolveCatalogLotOverlay({
      lot,
      sale: hybridSale,
      nowMs: t,
      saleroomSessionActive: true,
    });
    expect(vm).toEqual({ kind: "saleroom", label: "In saleroom", tone: "muted" });
  });
});
