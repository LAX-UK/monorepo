import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  listBidsForPublicApi,
  listLotsForPublicApi,
  listPublicBidHistory,
} from "./lot-public-api.js";
import type { LotServiceDeps } from "./lot-types.js";

const lot = (id: string): Lot =>
  ({
    id,
    status: "ended",
    auctionType: "english",
    winnerId: "next-bidder-user",
    buyerLegalEntityId: "next-bidder-entity",
    currentPrice: "88000.00",
    startingPrice: "100.00",
  }) as Lot;

const bid = {
  id: "b1",
  lotId: "open",
  amount: "88000.00",
  isWinning: false,
  isAutoBid: false,
  createdAt: new Date("2026-10-31T09:00:00Z"),
  placedByUserId: "defaulting-buyer",
  maxAutoBidAmount: "90000.00",
};

function deps(pending: string[]): LotServiceDeps {
  return {
    lotRepo: {
      list: vi.fn(async () => [lot("open"), lot("final")]),
      findById: vi.fn(async (id: string) => lot(id)),
    },
    bids: {
      listForLot: vi.fn(async () => [bid]),
      countForLot: vi.fn(async () => 1),
    },
    saleChannelReader: null,
    publicLotResults: {
      pendingAmong: async (ids: readonly string[]) =>
        new Set(ids.filter((id) => pending.includes(id))),
    },
  } as unknown as LotServiceDeps;
}

describe("public lot reads while a result is open", () => {
  it("lists such a lot as ended with no buyer or price, and leaves a final one alone", async () => {
    const { data } = await listLotsForPublicApi(
      deps(["open"]),
      { limit: 10, offset: 0, resolveImages: false },
      undefined,
    );
    const [open, final] = data as Lot[];
    expect(open).toMatchObject({ resultPending: true, winnerId: null, currentPrice: "100.00" });
    expect(JSON.stringify(open)).not.toContain("next-bidder");
    expect(final).toMatchObject({ winnerId: "next-bidder-user", currentPrice: "88000.00" });
  });

  it("lists the real buyer and price for staff", async () => {
    const { data } = await listLotsForPublicApi(
      deps(["open"]),
      { limit: 10, offset: 0, resolveImages: false },
      "staff",
      ["cataloguer"] as never,
    );
    expect((data as Lot[])[0]).toMatchObject({ winnerId: "next-bidder-user" });
  });

  it("shows no bid history, so the first buyer's price cannot be read from it", async () => {
    const result = await listPublicBidHistory(deps(["open"]), {
      lotId: "open",
      viewerId: undefined,
      limitQuery: undefined,
    });
    expect(result).toEqual({ kind: "ok", data: { entries: [], total: 0 } });
    const final = await listPublicBidHistory(deps(["open"]), {
      lotId: "final",
      viewerId: undefined,
      limitQuery: undefined,
    });
    expect(final.kind === "ok" && final.data.total).toBe(1);
  });

  it("lists no bids for the public, but staff still read them", async () => {
    const input = { lotId: "open", viewerId: undefined, limitQuery: undefined };
    expect(await listBidsForPublicApi(deps(["open"]), { ...input, viewerRole: "client" })).toEqual({
      kind: "ok",
      data: [],
    });
    const staff = await listBidsForPublicApi(deps(["open"]), {
      ...input,
      viewerRole: "staff",
      viewerStaffRoles: ["administrator"],
    });
    expect(staff.kind === "ok" && staff.data).toHaveLength(1);
  });
});
