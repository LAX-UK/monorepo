import type { SaleResultLotRow } from "@auction/persistence/interfaces";
import type { Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { SaleResultsSummaryService } from "./sale-results-summary.service.js";

const NOW = new Date("2026-11-01T12:00:00Z");
const CLOSE = new Date("2026-10-31T18:00:00Z");

const sale = (overrides: Partial<Sale> = {}) =>
  ({
    id: "s1",
    status: "ended",
    endTime: CLOSE,
    buyerPremiumTiers: null,
    ...overrides,
  }) as Sale;

const row = (id: string, overrides: Partial<SaleResultLotRow> = {}): SaleResultLotRow => ({
  id,
  saleId: "s1",
  status: "ended",
  currentPrice: "1000.00",
  buyerPremiumRate: "0.25",
  hasWinner: true,
  endTime: CLOSE,
  extendedUntil: null,
  ...overrides,
});

function service(rowsBySale: Record<string, SaleResultLotRow[]>, sold: Set<string> = new Set()) {
  const lots = {
    listBySaleIds: vi.fn(
      async (ids: string[]) =>
        new Map(ids.filter((id) => rowsBySale[id]).map((id) => [id, rowsBySale[id] ?? []])),
    ),
  };
  const channel = { getSoldLotIds: vi.fn(async () => sold) };
  return { svc: new SaleResultsSummaryService(lots, channel, () => NOW), lots, channel };
}

describe("SaleResultsSummaryService", () => {
  it("summarises an ended sale with the buyer's premium", async () => {
    const { svc } = service({
      s1: [row("a"), row("b", { currentPrice: "4000.00" }), row("c", { hasWinner: false })],
    });
    const summaries = await svc.summarise([sale()]);
    expect(summaries.get("s1")).toEqual({
      state: "final",
      lotCount: 3,
      soldCount: 2,
      currency: "GBP",
      totalWithPremium: "6250.00",
      topLot: { lotId: "b", priceWithPremium: "5000.00" },
      endedAt: CLOSE.toISOString(),
    });
  });

  it("uses the sale's tiered premium over the lot rate", async () => {
    const { svc } = service({ s1: [row("a", { currentPrice: "1000.00" })] });
    const tiers = [{ hammerThresholdMinor: 0, rate: "0.10" }];
    const summaries = await svc.summarise([sale({ buyerPremiumTiers: tiers })]);
    expect(summaries.get("s1")).toMatchObject({ totalWithPremium: "1100.00" });
  });

  it("is finalising while a lot is still in a soft-close extension", async () => {
    const { svc } = service({
      s1: [
        row("a"),
        row("b", { status: "active", extendedUntil: new Date("2026-11-01T12:03:00Z") }),
      ],
    });
    const summaries = await svc.summarise([sale()]);
    expect(summaries.get("s1")).toEqual({ state: "finalising", pendingLotCount: 1 });
  });

  it("leaves out sales that have not ended and reads nothing for them", async () => {
    const { svc, lots } = service({ s1: [row("a")] });
    const summaries = await svc.summarise([
      sale({ status: "active" }),
      sale({ status: "scheduled" }),
    ]);
    expect(summaries.size).toBe(0);
    expect(lots.listBySaleIds).not.toHaveBeenCalled();
  });

  it("reads all lots of all due sales in one query", async () => {
    const { svc, lots } = service({ s1: [row("a")], s2: [row("b", { saleId: "s2" })] });
    await svc.summarise([sale(), sale({ id: "s2" })]);
    expect(lots.listBySaleIds).toHaveBeenCalledTimes(1);
    expect(lots.listBySaleIds).toHaveBeenCalledWith(["s1", "s2"]);
  });

  it("counts the lots sold on ATG for an ATG-owned sale", async () => {
    const { svc, channel } = service(
      {
        s1: [
          row("a", { status: "draft", hasWinner: false }),
          row("b", { status: "draft", hasWinner: false }),
        ],
      },
      new Set(["a"]),
    );
    const summaries = await svc.summarise([
      sale({ status: "draft", sellingPlatform: "atg", atgAuctionState: "ended" }),
    ]);
    expect(channel.getSoldLotIds).toHaveBeenCalledWith("s1");
    expect(summaries.get("s1")).toMatchObject({ state: "final", lotCount: 2, soldCount: 1 });
  });

  it("is finalising while the ATG results have not landed", async () => {
    const { svc } = service({ s1: [row("a", { status: "draft", hasWinner: false })] });
    const summaries = await svc.summarise([
      sale({ status: "draft", sellingPlatform: "atg", atgAuctionState: "ended" }),
    ]);
    expect(summaries.get("s1")).toEqual({ state: "finalising", pendingLotCount: 1 });
  });
});
