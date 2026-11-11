import {
  ArtworkOfferLock,
  type ArtworkRegisterEntry,
  type OfferLockRegister,
  type OfferRef,
  type OfferState,
  transitionOffer,
} from "@auction/artwork-register-contracts";
import type { LotRegisterLink, RecordOfferConflictInput } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { AtgSoldRegisterService, atgSoldConflictMessage } from "./atg-sold-register.js";

const lotRef: OfferRef = { kind: "bid_lot", id: "lot-1" };
const NOW = new Date("2026-11-10T10:00:00Z");

function entry(state: OfferState, ref: OfferRef | null): ArtworkRegisterEntry {
  return {
    id: "reg-1",
    zohoProductId: "z-1",
    stockCode: "LAX-ORI-AR-PC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Harbour at dusk",
    artist: { zohoArtistId: null, name: "A", code: "AR" },
    medium: null,
    dimensions: null,
    year: null,
    imageRefs: [],
    catalogueStatus: null,
    offer: { state, ref },
    zohoModifiedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    version: 1,
  };
}

function setup(initial: ArtworkRegisterEntry, link: LotRegisterLink | null = linkOf()) {
  let current = initial;
  const moves: Array<{ to: OfferState; expectedVersion: number }> = [];
  const conflicts: RecordOfferConflictInput[] = [];
  const register: OfferLockRegister = {
    findById: async () => current,
    findByZohoProductId: async () => current,
    moveOffer: async (input) => {
      const move = transitionOffer(current.offer.state, input.to, input.ref);
      if (!move.ok) return { ok: false, reason: move.reason };
      moves.push({ to: input.to, expectedVersion: input.expectedVersion });
      current = {
        ...current,
        offer: { state: move.state, ref: move.ref },
        version: current.version + 1,
      };
      return { ok: true, entry: current };
    },
  };
  const service = new AtgSoldRegisterService(
    new ArtworkOfferLock(register, () => NOW),
    { findLink: async () => link },
    {
      recordOfferConflict: async (input) => {
        conflicts.push(input);
        return true;
      },
    },
    () => NOW,
  );
  return { service, moves, conflicts, state: () => current.offer };
}

function linkOf(over: Partial<LotRegisterLink> = {}): LotRegisterLink {
  return { registerId: "reg-1", status: "ended", hasWinner: false, soldOnAtg: true, ...over };
}

describe("AtgSoldRegisterService", () => {
  it("moves a register still in the Bid sale to sold", async () => {
    const { service, state } = setup(entry("bid_sale", lotRef));
    expect(await service.recordSold("lot-1")).toEqual({ status: "moved" });
    expect(state()).toEqual({ state: "sold", ref: lotRef });
  });

  it("moves a register the lot-ended path already withdrew to sold (result arrived late)", async () => {
    const { service, state, conflicts } = setup(entry("withdrawn", null));
    expect(await service.recordSold("lot-1")).toEqual({ status: "moved" });
    expect(state()).toEqual({ state: "sold", ref: lotRef });
    expect(conflicts).toEqual([]);
  });

  it("is idempotent: a repeated result changes nothing", async () => {
    const { service, moves } = setup(entry("withdrawn", null));
    await service.recordSold("lot-1");
    const writes = moves.length;
    expect(await service.recordSold("lot-1")).toEqual({ status: "unchanged" });
    expect(moves).toHaveLength(writes);
  });

  it("does not overwrite an artwork offered on lax.art since, and raises a staff item", async () => {
    const shop: OfferRef = { kind: "shop_artwork", id: "art-1" };
    const { service, moves, conflicts, state } = setup(entry("lax_art", shop));
    expect(await service.recordSold("lot-1")).toEqual({ status: "conflict", state: "lax_art" });
    expect(moves).toEqual([]);
    expect(state()).toEqual({ state: "lax_art", ref: shop });
    expect(conflicts).toEqual([
      {
        registerId: "reg-1",
        message: "Sold on ATG but now listed on lax.art",
        state: "lax_art",
        lotId: "lot-1",
        now: NOW,
      },
    ]);
  });

  it("raises a staff item when the register already shows a different sale", async () => {
    const other: OfferRef = { kind: "bid_lot", id: "lot-9" };
    const { service, conflicts } = setup(entry("sold", other));
    expect(await service.recordSold("lot-1")).toEqual({ status: "conflict", state: "sold" });
    expect(conflicts[0]?.message).toBe(atgSoldConflictMessage("sold"));
  });

  it("ignores a lot with no register link", async () => {
    const { service, moves } = setup(entry("withdrawn", null), null);
    expect(await service.recordSold("lot-1")).toEqual({ status: "not_governed" });
    expect(moves).toEqual([]);
  });
});
