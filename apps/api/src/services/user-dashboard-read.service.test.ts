import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { DashboardQueryService } from "./dashboard-query.service.js";
import { UserDashboardReadService } from "./user-dashboard-read.service.js";
import type { WatchlistService } from "./watchlist.service.js";

describe("UserDashboardReadService", () => {
  it("batch-presents images and checkout pricing for bids", async () => {
    const lot = { id: "lot-1", saleId: "sale-1", images: ["img-key"] } as Lot;
    const dashboardQuery = {
      listBidsWithLotsForBidder: vi.fn().mockResolvedValue([{ bid: { id: "b1" } as Bid, lot }]),
    } as unknown as DashboardQueryService;
    const watchlistService = {} as WatchlistService;
    const resolveManyUnique = vi.fn(async (keys: string[]) => {
      const map = new Map<string, string>();
      for (const key of keys) map.set(key, "https://cdn/img.jpg");
      return map;
    });
    const saleLookup = {
      findByIds: vi.fn().mockResolvedValue([{ id: "sale-1", buyerPremiumRate: "0.25" }]),
    };

    const service = new UserDashboardReadService(
      dashboardQuery,
      watchlistService,
      { resolveManyUnique } as never,
      saleLookup,
    );
    const rows = await service.listBidsForUser("user-1");

    expect(resolveManyUnique).toHaveBeenCalledWith(["img-key"]);
    expect(saleLookup.findByIds).toHaveBeenCalledWith(["sale-1"]);
    expect(rows[0]?.lot?.checkoutPricing).toBeDefined();
  });

  describe("a lot that has been invoiced", () => {
    const invoice = {
      totalPence: 125_000,
      pricingPolicyId: "flat:0.25",
      lines: [
        { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 100_000 },
        {
          kind: "buyers_premium",
          label: "Buyer's premium (25%)",
          ratePercent: "25",
          amountPence: 25_000,
        },
      ],
    };
    const lotWon = {
      id: "lot-1",
      saleId: null,
      images: [],
      currentPrice: "9999.00",
      buyerPremiumRate: "0.25",
      winnerId: "winner-1",
      buyerLegalEntityId: "acct-1",
    } as unknown as Lot;
    const batch = () => ({
      findLiveByLotsAndBuyerAccounts: vi.fn(async (pairs: { lotId: string }[]) =>
        pairs.some((p) => p.lotId === "lot-1")
          ? new Map([["lot-1:acct-1", invoice as never]])
          : new Map(),
      ),
    });
    const serviceFor = (invoices: ReturnType<typeof batch>, rows: unknown[]) =>
      new UserDashboardReadService(
        {
          listBidsWithLotsForBidder: vi.fn().mockResolvedValue(rows),
          listBidsWithLotsForBuyerAccount: vi.fn().mockResolvedValue(rows),
        } as unknown as DashboardQueryService,
        {} as WatchlistService,
        undefined,
        { findByIds: vi.fn().mockResolvedValue([]) },
        undefined,
        invoices as never,
      );

    it("shows the winner the invoice's figures, not the price now, reading all invoices in one query", async () => {
      const unsold = { ...lotWon, id: "lot-2", winnerId: null, buyerLegalEntityId: null } as Lot;
      const invoices = batch();
      const rows = await serviceFor(invoices, [
        { bid: { id: "b1" } as Bid, lot: lotWon },
        { bid: { id: "b2" } as Bid, lot: unsold },
      ]).listBidsForUser("winner-1");

      expect(rows[0]?.lot?.checkoutPricing).toMatchObject({
        hammerMajor: "1000.00",
        premiumMajor: "250.00",
        totalMajor: "1250.00",
      });
      // A lot nobody has won is priced as it stands.
      expect(rows[1]?.lot?.checkoutPricing?.hammerMajor).toBe("9999.00");
      expect(invoices.findLiveByLotsAndBuyerAccounts).toHaveBeenCalledTimes(1);
      expect(invoices.findLiveByLotsAndBuyerAccounts).toHaveBeenCalledWith([
        { lotId: "lot-1", buyerLegalEntityId: "acct-1" },
      ]);
    });

    it("never shows the winner's invoice to a bidder who lost or a watcher", async () => {
      const invoices = batch();
      const rows = await serviceFor(invoices, [
        { bid: { id: "b1" } as Bid, lot: lotWon },
      ]).listBidsForUser("someone-who-lost");
      expect(rows[0]?.lot?.checkoutPricing?.totalMajor).toBe("12498.75");
      expect(invoices.findLiveByLotsAndBuyerAccounts).toHaveBeenCalledWith([]);
    });

    it("shows an account's members the invoices of the lots that account bought", async () => {
      const invoices = batch();
      const rows = await serviceFor(invoices, [
        { bid: { id: "b1" } as Bid, lot: lotWon },
      ]).listBidsForBuyerAccount("acct-1", null);
      expect(rows[0]?.lot?.checkoutPricing?.totalMajor).toBe("1250.00");
      const other = await serviceFor(batch(), [
        { bid: { id: "b1" } as Bid, lot: lotWon },
      ]).listBidsForBuyerAccount("acct-2", null);
      expect(other[0]?.lot?.checkoutPricing?.totalMajor).toBe("12498.75");
    });
  });
});

describe("UserDashboardReadService lots that are not the reader's", () => {
  // The lot defaulted and was re-awarded to the next bidder, who has not paid yet. The row holds
  // the new buyer and the offer price; the public result is still open.
  const reawarded = {
    id: "lot-pending",
    saleId: null,
    images: [],
    status: "ended",
    startingPrice: "100.00",
    currentPrice: "900.00",
    winnerId: "next-bidder",
    buyerLegalEntityId: "next-account",
  } as unknown as Lot;
  // Before the re-award: no buyer, but the price is still the hammer of the winner who did not pay.
  const beforeReaward = {
    ...reawarded,
    id: "lot-defaulted",
    currentPrice: "1000.00",
    winnerId: null,
    buyerLegalEntityId: null,
  } as Lot;
  // An ordinary sold lot, bought by someone else.
  const sold = {
    ...reawarded,
    id: "lot-sold",
    currentPrice: "500.00",
    winnerId: "someone",
    buyerLegalEntityId: "someone-account",
  } as Lot;
  const pendingAmong = () =>
    vi.fn(async (ids: string[]) => new Set(ids.filter((id) => id !== "lot-sold")));
  const service = (
    reader: { pendingAmong: ReturnType<typeof pendingAmong> },
    rows: { bids?: unknown[]; watchlist?: unknown[] },
  ) =>
    new UserDashboardReadService(
      {
        listBidsWithLotsForBidder: vi.fn().mockResolvedValue(rows.bids ?? []),
        listBidsWithLotsForBuyerAccount: vi.fn().mockResolvedValue(rows.bids ?? []),
      } as unknown as DashboardQueryService,
      {
        listWithLots: vi.fn().mockResolvedValue(rows.watchlist ?? []),
      } as unknown as WatchlistService,
      undefined,
      { findByIds: vi.fn().mockResolvedValue([]) },
      undefined,
      undefined,
      reader as never,
    );
  const watched = (lot: Lot) => ({ watchlistId: `w-${lot.id}`, lotId: lot.id, lot });
  const bidOn = (lot: Lot, buyerLegalEntityId?: string) => ({
    bid: {
      id: `b-${lot.id}`,
      lotId: lot.id,
      ...(buyerLegalEntityId ? { buyerLegalEntityId } : {}),
    },
    lot,
  });

  it("GET /users/me/watchlist: shows a watcher an open result as ended, with no buyer, price or pricing", async () => {
    const reader = { pendingAmong: pendingAmong() };
    const rows = await service(reader, {
      watchlist: [watched(reawarded), watched(beforeReaward), watched(sold)],
    }).listWatchlistForUser("watcher");

    for (const row of rows.slice(0, 2)) {
      expect(row.lot).toMatchObject({
        currentPrice: "100.00",
        winnerId: null,
        buyerLegalEntityId: null,
        hasWinner: false,
        resultPending: true,
      });
      expect(row.lot?.checkoutPricing).toBeUndefined();
    }
    // A final result keeps its price, but never says who bought it.
    expect(rows[2]?.lot).toMatchObject({
      currentPrice: "500.00",
      winnerId: null,
      buyerLegalEntityId: null,
      hasWinner: true,
    });
    expect(rows[2]?.lot?.resultPending).toBeUndefined();
  });

  it("GET /users/me/watchlist: shows the new buyer their own lot and price", async () => {
    const reader = { pendingAmong: pendingAmong() };
    const rows = await service(reader, { watchlist: [watched(reawarded)] }).listWatchlistForUser(
      "next-bidder",
    );
    expect(rows[0]?.lot).toMatchObject({
      currentPrice: "900.00",
      winnerId: "next-bidder",
      buyerLegalEntityId: "next-account",
    });
    expect(rows[0]?.lot?.resultPending).toBeUndefined();
    expect(reader.pendingAmong).not.toHaveBeenCalled();
  });

  it("GET /users/me/bids: shows a losing bidder an open result as ended, before and after the re-award", async () => {
    const reader = { pendingAmong: pendingAmong() };
    const rows = await service(reader, {
      bids: [bidOn(reawarded, "loser-account"), bidOn(beforeReaward, "loser-account")],
    }).listBidsForUser("loser");
    expect(reader.pendingAmong).toHaveBeenCalledWith(["lot-pending", "lot-defaulted"]);
    for (const row of rows) {
      expect(row.lot).toMatchObject({
        currentPrice: "100.00",
        winnerId: null,
        buyerLegalEntityId: null,
        resultPending: true,
      });
    }
  });

  it("GET /users/me/bids: shows a lot won through an account the bidder bid for as theirs", async () => {
    const reader = { pendingAmong: pendingAmong() };
    const rows = await service(reader, {
      bids: [bidOn(reawarded, "next-account")],
    }).listBidsForUser("colleague");
    expect(rows[0]?.lot).toMatchObject({
      currentPrice: "900.00",
      buyerLegalEntityId: "next-account",
    });
    expect(rows[0]?.lot?.resultPending).toBeUndefined();
  });

  it("GET /users/me/account/bids: shows the buying account its own lot, and others' lots without ids", async () => {
    const reader = { pendingAmong: pendingAmong() };
    const rows = await service(reader, {
      bids: [bidOn(reawarded, "next-account"), bidOn(sold, "next-account")],
    }).listBidsForBuyerAccount("next-account", null);
    expect(rows[0]?.lot).toMatchObject({ currentPrice: "900.00", winnerId: "next-bidder" });
    expect(rows[1]?.lot).toMatchObject({
      winnerId: null,
      buyerLegalEntityId: null,
      hasWinner: true,
    });
  });
});
