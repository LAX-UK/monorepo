import {
  ArtworkOfferLock,
  type ArtworkRegisterEntry,
  InventoryPeerRefusedError,
  InventoryPeerUnavailableError,
} from "@auction/artwork-register-contracts";
import type { LotRegisterLink } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ReturnLotToLaxArtService } from "./return-lot-to-lax-art.service.js";

const LOT_ID = "lot-1";
const REGISTER_ID = "11111111-1111-4111-8111-111111111111";
const SHOP_ARTWORK_ID = "55555555-5555-4555-8555-555555555555";

const entry = (over: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry =>
  ({
    id: REGISTER_ID,
    kind: "original",
    title: "Blue room",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    offer: { state: "bid_sale", ref: { kind: "bid_lot", id: LOT_ID } },
    version: 4,
    ...over,
  }) as ArtworkRegisterEntry;

const link = (over: Partial<LotRegisterLink> = {}): LotRegisterLink => ({
  registerId: REGISTER_ID,
  status: "ended",
  hasWinner: false,
  ...over,
});

function setup(
  over: {
    link?: LotRegisterLink | null;
    entry?: ArtworkRegisterEntry | null;
    reopen?: () => Promise<{ artworkId: string; reopened: boolean }>;
  } = {},
) {
  let current = over.entry === undefined ? entry() : over.entry;
  const moveOffer = vi.fn(async (input: { to: string }) => {
    current = {
      ...(current as ArtworkRegisterEntry),
      offer: { state: input.to, ref: null },
    } as never;
    return { ok: true as const, entry: current as ArtworkRegisterEntry };
  });
  const register = {
    findById: vi.fn(async () => current),
    findByZohoProductId: vi.fn(async () => current),
    moveOffer,
  };
  const reopen = vi.fn(
    over.reopen ?? (async () => ({ artworkId: SHOP_ARTWORK_ID, reopened: true })),
  );
  const recordMoveConfirmed = vi.fn().mockResolvedValue({ status: "recorded" });
  const service = new ReturnLotToLaxArtService({
    links: { findLink: vi.fn().mockResolvedValue(over.link === undefined ? link() : over.link) },
    register,
    lock: new ArtworkOfferLock(register as never),
    shop: { reopen },
    history: { recordMoveConfirmed },
    now: () => new Date("2026-11-03T12:00:00Z"),
  });
  return { service, moveOffer, reopen, recordMoveConfirmed };
}

describe("ReturnLotToLaxArtService.describe", () => {
  it("says a lot with no register link has nothing to move", async () => {
    expect(await setup({ link: null }).service.describe(LOT_ID)).toEqual({ linked: false });
  });

  it("says a lot that ended unsold can go back, naming the artwork", async () => {
    expect(await setup().service.describe(LOT_ID)).toEqual({
      linked: true,
      title: "Blue room",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      canReturn: true,
      reasons: [],
    });
  });

  it("gives the reason when it cannot", async () => {
    const view = await setup({ link: link({ status: "active" }) }).service.describe(LOT_ID);
    expect(view).toMatchObject({ linked: true, canReturn: false });
    expect((view as { reasons: string[] }).reasons[0]).toMatch(/still in a sale/);
  });
});

describe("ReturnLotToLaxArtService.returnToLaxArt", () => {
  it("withdraws the artwork from the lot, reopens the lax.art draft and records who confirmed", async () => {
    const { service, moveOffer, reopen, recordMoveConfirmed } = setup();
    expect(await service.returnToLaxArt(LOT_ID, "user-1")).toEqual({ ok: true, reopened: true });
    expect(moveOffer).toHaveBeenCalledWith(
      expect.objectContaining({ to: "withdrawn", actor: "staff:user-1", registerId: REGISTER_ID }),
    );
    expect(reopen).toHaveBeenCalledWith({ registerId: REGISTER_ID, actor: "staff:user-1" });
    expect(recordMoveConfirmed).toHaveBeenCalledWith({
      registerId: REGISTER_ID,
      actor: "staff:user-1",
      record: {
        direction: "to_lax_art",
        lotId: LOT_ID,
        shopArtworkId: SHOP_ARTWORK_ID,
        confirmedBy: "staff:user-1",
      },
      now: new Date("2026-11-03T12:00:00Z"),
    });
  });

  it("is safe to repeat: an artwork already withdrawn is not moved again", async () => {
    const { service, moveOffer } = setup({
      entry: entry({ offer: { state: "withdrawn", ref: null } }),
      reopen: async () => ({ artworkId: SHOP_ARTWORK_ID, reopened: false }),
    });
    expect(await service.returnToLaxArt(LOT_ID, "user-1")).toEqual({ ok: true, reopened: false });
    expect(moveOffer).not.toHaveBeenCalled();
  });

  it("refuses before changing anything when the lot cannot go back", async () => {
    const { service, moveOffer, reopen } = setup({ link: link({ hasWinner: true }) });
    const result = await service.returnToLaxArt(LOT_ID, "user-1");
    expect(result).toMatchObject({ ok: false, status: 409, code: "has_winner" });
    expect(moveOffer).not.toHaveBeenCalled();
    expect(reopen).not.toHaveBeenCalled();
  });

  it("answers 404 for a lot with no register link", async () => {
    const result = await setup({ link: null }).service.returnToLaxArt(LOT_ID, "user-1");
    expect(result).toMatchObject({ ok: false, status: 404, code: "no_register_record" });
  });

  it("tells staff to try again when LAX Shop cannot be reached, and records nothing", async () => {
    const { service, recordMoveConfirmed } = setup({
      reopen: async () => {
        throw new InventoryPeerUnavailableError("network");
      },
    });
    const result = await service.returnToLaxArt(LOT_ID, "user-1");
    expect(result).toMatchObject({ ok: false, status: 502, code: "inventory_peer_unavailable" });
    expect((result as { error: string }).error).toMatch(/Try again/);
    expect(recordMoveConfirmed).not.toHaveBeenCalled();
  });

  it("passes on LAX Shop's reason when it refuses", async () => {
    const { service } = setup({
      reopen: async () => {
        throw new InventoryPeerRefusedError(
          { error: "no_listing", message: "There is no lax.art record for this artwork yet." },
          409,
        );
      },
    });
    expect(await service.returnToLaxArt(LOT_ID, "user-1")).toEqual({
      ok: false,
      status: 409,
      code: "no_listing",
      error: "There is no lax.art record for this artwork yet.",
    });
  });
});
