import {
  type ArtworkRegisterEntry,
  InventoryPeerRefusedError,
  InventoryPeerUnavailableError,
} from "@auction/artwork-register-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { OriginalForMove } from "../ports/original-move.js";
import { OriginalMoveService } from "./original-move.service.js";

const ARTWORK_ID = "11111111-1111-4111-8111-111111111111";
const REGISTER_ID = "22222222-2222-4222-8222-222222222222";
const SALE_ID = "33333333-3333-4333-8333-333333333333";
const LOT_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-11-03T12:00:00Z");

const original = (over: Partial<OriginalForMove> = {}): OriginalForMove => ({
  artworkId: ARTWORK_ID,
  title: "Blue room",
  artistName: "A. Artist",
  description: "A quiet interior.",
  provenance: "The artist",
  medium: "Oil",
  dimensions: "80 x 60 cm",
  yearCreated: 2021,
  imageKeys: ["k1.jpg", "k2.jpg"],
  primaryImageUrl: "k1.jpg",
  zohoProductId: "z-1",
  salesChannel: "art",
  runKind: null,
  markedSold: false,
  onLaxArt: true,
  archived: false,
  openOriginalSale: false,
  ...over,
});

const entry = (over: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry =>
  ({
    id: REGISTER_ID,
    kind: "original",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    offer: { state: "lax_art", ref: { kind: "shop_artwork", id: ARTWORK_ID } },
    ...over,
  }) as ArtworkRegisterEntry;

function setup(
  over: {
    original?: OriginalForMove | null;
    entry?: ArtworkRegisterEntry | null;
    sales?: Array<{ id: string; title: string; startsAt: string }>;
    createDraftLot?: () => Promise<unknown>;
    withdraw?: () => Promise<void>;
  } = {},
) {
  const withdrawFromLaxArt = vi.fn(over.withdraw ?? (async () => undefined));
  const createDraftLot = vi.fn(
    over.createDraftLot ?? (async () => ({ lotId: LOT_ID, saleId: SALE_ID, created: true })),
  );
  const recordMoveConfirmed = vi.fn().mockResolvedValue({ status: "recorded" });
  const service = new OriginalMoveService({
    originals: {
      findById: vi.fn().mockResolvedValue(over.original === undefined ? original() : over.original),
      findByZohoProductId: vi.fn(),
    },
    register: {
      findByZohoProductId: vi
        .fn()
        .mockResolvedValue(over.entry === undefined ? entry() : over.entry),
    },
    history: { recordMoveConfirmed },
    auction: {
      listSales: vi
        .fn()
        .mockResolvedValue(
          over.sales ?? [
            { id: SALE_ID, title: "Winter sale", startsAt: "2026-12-01T10:00:00.000Z" },
          ],
        ),
      createDraftLot: createDraftLot as never,
    },
    withdrawFromLaxArt,
    resolveImageUrl: (value) => (value ? `https://media.example/${value}` : null),
    now: () => NOW,
  });
  return { service, withdrawFromLaxArt, createDraftLot, recordMoveConfirmed };
}

const command = {
  artworkId: ARTWORK_ID,
  saleId: SALE_ID,
  startingPrice: "250.00",
  actorSubjectId: "user-1",
};

describe("OriginalMoveService.assess", () => {
  it("says an original on lax.art can move, with its stock code", async () => {
    expect(await setup().service.assess(ARTWORK_ID)).toEqual({
      artworkId: ARTWORK_ID,
      title: "Blue room",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      onLaxArt: true,
      eligible: true,
      reasons: [],
    });
  });

  it("gives every reason in words for staff", async () => {
    const result = await setup({
      original: original({ openOriginalSale: true }),
      entry: entry({ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: LOT_ID } } }),
    }).service.assess(ARTWORK_ID);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons.join(" ")).toMatch(/reserved/);
    expect(result.reasons.join(" ")).toMatch(/already in a LAX Bid sale/);
  });

  it("refuses an artwork with no register record, and an edition run", async () => {
    expect((await setup({ entry: null }).service.assess(ARTWORK_ID)).reasons[0]).toMatch(
      /not in the artwork register/,
    );
    expect(
      (await setup({ original: original({ runKind: "limited" }) }).service.assess(ARTWORK_ID))
        .reasons[0],
    ).toMatch(/Only originals/);
  });

  it("is a 404 for an artwork that does not exist", async () => {
    await expect(setup({ original: null }).service.assess(ARTWORK_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("OriginalMoveService.offerAtAuction", () => {
  it("makes the draft lot first, then takes the listing down, then records who confirmed", async () => {
    const { service, createDraftLot, withdrawFromLaxArt, recordMoveConfirmed } = setup();
    const order: string[] = [];
    createDraftLot.mockImplementation(async () => {
      order.push("lot");
      return { lotId: LOT_ID, saleId: SALE_ID, created: true };
    });
    withdrawFromLaxArt.mockImplementation(async () => {
      order.push("withdraw");
    });
    recordMoveConfirmed.mockImplementation(async () => {
      order.push("record");
      return { status: "recorded" };
    });
    expect(await service.offerAtAuction(command)).toEqual({
      lotId: LOT_ID,
      saleId: SALE_ID,
      saleTitle: "Winter sale",
      withdrawnFromLaxArt: true,
    });
    expect(order).toEqual(["lot", "withdraw", "record"]);
    expect(createDraftLot).toHaveBeenCalledWith(
      expect.objectContaining({
        registerId: REGISTER_ID,
        saleId: SALE_ID,
        startingPrice: "250.00",
        actor: "staff:user-1",
        content: expect.objectContaining({
          title: "Blue room",
          artistName: "A. Artist",
          year: 2021,
          imageUrls: ["https://media.example/k1.jpg", "https://media.example/k2.jpg"],
        }),
      }),
    );
    expect(withdrawFromLaxArt).toHaveBeenCalledWith({
      artworkId: ARTWORK_ID,
      actorSubjectId: "user-1",
    });
    expect(recordMoveConfirmed).toHaveBeenCalledWith({
      registerId: REGISTER_ID,
      actor: "staff:user-1",
      record: {
        direction: "to_auction",
        saleId: SALE_ID,
        lotId: LOT_ID,
        consignorAgreed: true,
        confirmedBy: "staff:user-1",
      },
      now: NOW,
    });
  });

  it("leaves an original that is not on lax.art alone", async () => {
    const { service, withdrawFromLaxArt } = setup({ original: original({ onLaxArt: false }) });
    expect(await service.offerAtAuction(command)).toMatchObject({ withdrawnFromLaxArt: false });
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
  });

  it("changes nothing when the original cannot move", async () => {
    const { service, createDraftLot, withdrawFromLaxArt } = setup({
      original: original({ markedSold: true }),
    });
    await expect(service.offerAtAuction(command)).rejects.toBeInstanceOf(ShopDomainError);
    expect(createDraftLot).not.toHaveBeenCalled();
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
  });

  it("refuses a sale that is no longer offered", async () => {
    const { service, createDraftLot } = setup({ sales: [] });
    await expect(service.offerAtAuction(command)).rejects.toThrow(/no longer open/);
    expect(createDraftLot).not.toHaveBeenCalled();
  });

  it("keeps the listing up when LAX Bid cannot be reached, so staff just try again", async () => {
    const { service, withdrawFromLaxArt } = setup({
      createDraftLot: async () => {
        throw new InventoryPeerUnavailableError("network");
      },
    });
    const error = await service.offerAtAuction(command).catch((e) => e);
    expect(error).toBeInstanceOf(ShopApiError);
    expect(error.statusCode).toBe(502);
    expect(error.message).toMatch(/Try again/);
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
  });

  it("passes on LAX Bid's reason when it refuses, and keeps the listing up", async () => {
    const { service, withdrawFromLaxArt } = setup({
      createDraftLot: async () => {
        throw new InventoryPeerRefusedError(
          { error: "already_drafted", message: "This artwork already has a lot in another sale." },
          409,
        );
      },
    });
    await expect(service.offerAtAuction(command)).rejects.toThrow(/another sale/);
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
  });

  it("says the lot is ready when taking the listing down fails, and reuses the lot on retry", async () => {
    let fail = true;
    const { service, createDraftLot, withdrawFromLaxArt } = setup({
      withdraw: async () => {
        if (fail) throw new Error("db down");
      },
    });
    const first = await service.offerAtAuction(command).catch((e) => e);
    expect(first).toBeInstanceOf(ShopApiError);
    expect(first.message).toMatch(/draft lot is ready in Winter sale/);
    fail = false;
    createDraftLot.mockResolvedValueOnce({ lotId: LOT_ID, saleId: SALE_ID, created: false });
    expect(await service.offerAtAuction(command)).toMatchObject({ lotId: LOT_ID });
    expect(withdrawFromLaxArt).toHaveBeenCalledTimes(2);
  });
});
