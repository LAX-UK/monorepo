import type { BidAuthorityDecision } from "@auction/domain";
import type { LotViewerRawFacts } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { LotViewerActor } from "../interfaces/lot-viewer-state.js";
import { LotViewerStateService } from "./lot-viewer-state.service.js";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const owner: LotViewerActor = { userId: "u1", legalEntityId: "e1", memberRole: "owner" };
const agent: LotViewerActor = { ...owner, memberRole: "buyer_agent" };

function facts(over: Partial<LotViewerRawFacts> = {}): LotViewerRawFacts {
  return {
    lotId: "lot-1",
    saleId: "sale-1",
    lotStatus: "active",
    auctionType: "english",
    currentPrice: "7000.00",
    startingPrice: "4200.00",
    minBidIncrement: "250.00",
    registration: null,
    leading: false,
    won: false,
    hasBid: false,
    highestBid: null,
    maxBid: null,
    payment: null,
    ...over,
  };
}

function service(rows: LotViewerRawFacts[], available: number | null = null) {
  const load = vi.fn(async () => rows);
  const resolve = vi.fn(
    async (): Promise<BidAuthorityDecision> => ({
      allowed: true,
      role: "buyer_agent",
      viaAuthorisation: true,
      bidLimit: null,
      totalLimit: null,
    }),
  );
  const room = vi.fn(async () =>
    available === null
      ? null
      : { kind: "authorisation_total" as const, limit: 10_000, exposure: 0, available },
  );
  return {
    load,
    resolve,
    room,
    svc: new LotViewerStateService({
      facts: { load },
      bidAuthority: { resolve },
      limitGate: { room },
      now: () => NOW,
    }),
  };
}

describe("LotViewerStateService.forLot", () => {
  it("is null for a lot that does not exist", async () => {
    expect(await service([]).svc.forLot({ actor: owner, lotId: "x" })).toBeNull();
  });

  it("reads position, maximum and registration through the domain reader", async () => {
    const { svc } = service([
      facts({
        hasBid: true,
        leading: true,
        highestBid: "7000.00",
        maxBid: "9000.00",
        registration: "approved",
      }),
    ]);
    expect(await svc.forLot({ actor: owner, lotId: "lot-1" })).toMatchObject({
      registration: "approved",
      position: "leading",
      myHighestBid: "7000.00",
      myMaxBid: "9000.00",
      purchase: null,
    });
  });

  it("buyer agents must register for a sale; other members need not", async () => {
    const { svc } = service([facts()]);
    expect((await svc.forLot({ actor: agent, lotId: "lot-1" }))?.registrationRequired).toBe(true);
    expect((await svc.forLot({ actor: owner, lotId: "lot-1" }))?.registrationRequired).toBe(false);
    const noSale = service([facts({ saleId: null })]).svc;
    expect((await noSale.forLot({ actor: agent, lotId: "lot-1" }))?.registrationRequired).toBe(
      false,
    );
  });

  it("reports an agent's room under their limits, and reads it only for agents", async () => {
    const withLimit = service([facts()], 1500);
    expect((await withLimit.svc.forLot({ actor: agent, lotId: "lot-1" }))?.agentLimitLeft).toBe(
      "1500.00",
    );
    expect(withLimit.room).toHaveBeenCalledWith(
      expect.objectContaining({ lotId: "lot-1", saleId: "sale-1", legalEntityId: "e1" }),
    );

    const forOwner = service([facts()], 1500);
    expect(
      (await forOwner.svc.forLot({ actor: owner, lotId: "lot-1" }))?.agentLimitLeft,
    ).toBeNull();
    expect(forOwner.room).not.toHaveBeenCalled();

    const unlimited = service([facts()], null);
    expect(
      (await unlimited.svc.forLot({ actor: agent, lotId: "lot-1" }))?.agentLimitLeft,
    ).toBeNull();
  });

  it("names the invoice behind a win with its state and due date", async () => {
    const raisedAt = new Date("2026-11-01T12:00:00.000Z");
    const { svc } = service([
      facts({
        lotStatus: "ended",
        won: true,
        hasBid: true,
        payment: { id: "pay-1", status: "pending", raisedAt },
      }),
    ]);
    const view = await svc.forLot({ actor: owner, lotId: "lot-1" });
    expect(view?.position).toBe("won");
    expect(view?.purchase).toMatchObject({ id: "pay-1", status: "due" });
    expect(view?.purchase?.dueAt).toBe("2026-11-08T12:00:00.000Z");
  });

  it("leaves the purchase out for a lot the account did not win", async () => {
    const { svc } = service([
      facts({
        lotStatus: "ended",
        won: false,
        hasBid: true,
        payment: { id: "pay-1", status: "pending", raisedAt: NOW },
      }),
    ]);
    expect((await svc.forLot({ actor: owner, lotId: "lot-1" }))?.purchase).toBeNull();
  });
});

describe("LotViewerStateService.forLots", () => {
  it("lists only lots the account has bid on, with the next bid for open lots", async () => {
    const { svc } = service([
      facts({ lotId: "a", hasBid: true, leading: false }),
      facts({ lotId: "b" }),
      facts({ lotId: "c", lotStatus: "ended", hasBid: true, won: true }),
    ]);
    expect(await svc.forLots({ actor: owner, lotIds: ["a", "b", "c"] })).toEqual([
      { lotId: "a", position: "outbid", nextBidAmount: "7250.00" },
      { lotId: "c", position: "won", nextBidAmount: null },
    ]);
  });

  it("asks for at most 60 lots, in one read", async () => {
    const { svc, load } = service([]);
    const ids = Array.from({ length: 80 }, (_, i) => `lot-${i}`);
    await svc.forLots({ actor: owner, lotIds: ids });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]?.[0].lotIds).toHaveLength(60);
  });
});
