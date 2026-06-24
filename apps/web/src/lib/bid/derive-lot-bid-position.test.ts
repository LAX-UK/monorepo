import { describe, expect, it } from "vitest";
import { deriveLotBidPosition } from "./derive-lot-bid-position";

const base = {
  sessionUserId: "buyer-1",
  sellerId: "seller-1",
  lotStatus: "active" as const,
  lifecycleKind: "live" as const,
  leadingBidderId: "buyer-2",
  winnerId: null,
  userHasBid: true,
  outbidSignal: false,
  activeAutoBid: null,
  endedBanner: null,
};

describe("deriveLotBidPosition", () => {
  it("returns owner when session is seller", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        sessionUserId: "seller-1",
        sellerId: "seller-1",
      }),
    ).toEqual({ kind: "owner" });
  });

  it("returns owner when isOwnLot is true", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        sessionUserId: "buyer-1",
        sellerId: null,
        isOwnLot: true,
      }),
    ).toEqual({ kind: "owner" });
  });

  it("returns notSignedIn without session", () => {
    expect(deriveLotBidPosition({ ...base, sessionUserId: null })).toEqual({
      kind: "notSignedIn",
    });
  });

  it("returns winning when leading without auto-bid", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        leadingBidderId: "buyer-1",
      }),
    ).toEqual({ kind: "winning", autoBid: null });
  });

  it("returns winningByAuto when leading with active auto-bid", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        leadingBidderId: "buyer-1",
        lifecycleKind: "live",
        activeAutoBid: {
          maxAutoBidAmount: "500",
          autoBidStepAmount: "10",
          isActive: true,
        },
      }),
    ).toEqual({
      kind: "winningByAuto",
      autoBid: { max: "500", step: "10" },
    });
  });

  it("returns outbid when outbidSignal is true", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        outbidSignal: true,
      }),
    ).toEqual({ kind: "outbid", autoBid: null });
  });

  it("returns inRunning when user bid but not leading and no outbid signal", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        userHasBid: true,
        leadingBidderId: "buyer-2",
        outbidSignal: false,
      }),
    ).toEqual({ kind: "inRunning", autoBid: null });
  });

  it("returns notBidding when user has not bid", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        userHasBid: false,
        leadingBidderId: "buyer-2",
      }),
    ).toEqual({ kind: "notBidding" });
  });

  it("returns won for ended sold when user is winner", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        lotStatus: "ended",
        lifecycleKind: "endedSold",
        winnerId: "buyer-1",
        endedBanner: "You won",
      }),
    ).toEqual({ kind: "won", hammerLabel: "You won" });
  });

  it("returns leadingBelowReserve when leading with reserve not met", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        leadingBidderId: "buyer-1",
        reserveContext: { hasReserve: true, reserveMet: false },
      }),
    ).toEqual({ kind: "leadingBelowReserve", autoBid: null });
  });

  it("returns winning when leading with reserve met", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        leadingBidderId: "buyer-1",
        reserveContext: { hasReserve: true, reserveMet: true },
      }),
    ).toEqual({ kind: "winning", autoBid: null });
  });

  it("returns noSale with reason when provided", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        lotStatus: "ended",
        lifecycleKind: "endedNoSale",
        noSaleReason: "no_bids",
      }),
    ).toEqual({ kind: "noSale", noSaleReason: "no_bids" });
  });

  it("returns noSale for ended without winner", () => {
    expect(
      deriveLotBidPosition({
        ...base,
        lotStatus: "ended",
        lifecycleKind: "endedNoSale",
      }),
    ).toEqual({ kind: "noSale", noSaleReason: null });
  });
});
