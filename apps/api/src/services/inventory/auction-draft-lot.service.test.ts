import type { ArtworkRegisterEntry, DraftLotRequest } from "@auction/artwork-register-contracts";
import type { CreateLotInput, Lot } from "@auction/types";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { LotError } from "../../lib/errors.js";
import { AuctionDraftLotService } from "./auction-draft-lot.service.js";

const REGISTER_ID = "11111111-1111-4111-8111-111111111111";
const SALE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SALE_ID = "33333333-3333-4333-8333-333333333333";
const SELLER_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-11-03T12:00:00Z");

const entry = (over: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry =>
  ({
    id: REGISTER_ID,
    kind: "original",
    offer: { state: "withdrawn", ref: null },
    version: 3,
    ...over,
  }) as ArtworkRegisterEntry;

const request: DraftLotRequest = {
  registerId: REGISTER_ID,
  saleId: SALE_ID,
  startingPrice: "250.00",
  actor: "staff:user-1",
  content: {
    title: "Blue room",
    artistName: "A. Artist",
    medium: "Oil on canvas",
    dimensions: "80 x 60 cm",
    year: 2021,
    description: "A quiet interior.",
    provenance: "The artist, then a private collection",
    imageUrls: ["https://media.example/a.jpg", "https://media.example/b.jpg"],
  },
};

function setup(
  over: {
    register?: ArtworkRegisterEntry | null;
    existing?: { lotId: string; saleId: string | null; status: "draft" } | null;
    sales?: Array<{ id: string; title: string; startsAt: Date; endsAt: Date }>;
    seller?: string | null;
    artists?: Array<{ id: string; displayName: string }>;
    create?: (input: CreateLotInput) => unknown;
  } = {},
) {
  const create = vi.fn(async (_seller: string, input: CreateLotInput) =>
    over.create ? over.create(input) : ok({ id: "lot-new", ...input } as unknown as Lot),
  );
  const findOpenLotForRegister = vi.fn().mockResolvedValue(over.existing ?? null);
  const service = new AuctionDraftLotService({
    offers: {
      listSalesOpenForOffer: vi.fn().mockResolvedValue(
        over.sales ?? [
          {
            id: SALE_ID,
            title: "Winter sale",
            startsAt: new Date("2026-12-01T10:00:00Z"),
            endsAt: new Date("2026-12-02T10:00:00Z"),
          },
        ],
      ),
      findOpenLotForRegister,
    },
    register: {
      findById: vi.fn().mockResolvedValue(over.register === undefined ? entry() : over.register),
    },
    lots: { create: create as never },
    artists: { search: vi.fn().mockResolvedValue(over.artists ?? []) as never },
    resolveHouseSellerLegalEntityId: vi
      .fn()
      .mockResolvedValue(over.seller === undefined ? SELLER_ID : over.seller),
    now: () => NOW,
  });
  return { service, create, findOpenLotForRegister };
}

describe("AuctionDraftLotService.listSales", () => {
  it("lists the sales that can take a lot, soonest first, with ISO start times", async () => {
    const { service } = setup();
    expect(await service.listSales()).toEqual([
      { id: SALE_ID, title: "Winter sale", startsAt: "2026-12-01T10:00:00.000Z" },
    ]);
  });
});

describe("AuctionDraftLotService.createDraft", () => {
  it("makes a draft lot in the chosen sale, linked to the register and filled from the artwork", async () => {
    const { service, create } = setup({ artists: [{ id: "artist-1", displayName: "A. Artist" }] });
    const outcome = await service.createDraft(request);
    expect(outcome).toEqual({
      ok: true,
      data: { lotId: "lot-new", saleId: SALE_ID, created: true },
    });
    const input = create.mock.calls[0]?.[1] as CreateLotInput;
    expect(create.mock.calls[0]?.[0]).toBe(SELLER_ID);
    expect(input).toMatchObject({
      title: "Blue room",
      medium: "Oil on canvas",
      dimensions: "80 x 60 cm",
      images: request.content.imageUrls,
      artworkRegisterId: REGISTER_ID,
      artistId: "artist-1",
      saleId: SALE_ID,
      startingPrice: "250.00",
      sellerLegalEntityId: SELLER_ID,
      auctionType: "english",
    });
    expect(input.description).toContain("A quiet interior.");
    expect(input.description).toContain("Made in 2021.");
    expect(input.marketingDetails?.provenance).toEqual([
      { note: "The artist, then a private collection" },
    ]);
    expect(input.startTime).toEqual(new Date("2026-12-01T10:00:00Z"));
    expect(input.endTime).toEqual(new Date("2026-12-02T10:00:00Z"));
  });

  it("keeps the artist's name on the lot when the registry has no single match", async () => {
    const { service, create } = setup({
      artists: [
        { id: "a", displayName: "A. Artist" },
        { id: "b", displayName: "A. Artist" },
      ],
    });
    await service.createDraft(request);
    const input = create.mock.calls[0]?.[1] as CreateLotInput;
    expect(input.artistId).toBeUndefined();
    expect(input.marketingDetails?.artistNote).toBe("A. Artist");
  });

  it("returns the draft that already exists for the same sale, without making another", async () => {
    const { service, create } = setup({
      existing: { lotId: "lot-9", saleId: SALE_ID, status: "draft" },
    });
    expect(await service.createDraft(request)).toEqual({
      ok: true,
      data: { lotId: "lot-9", saleId: SALE_ID, created: false },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses when the artwork already has a lot in another sale", async () => {
    const { service, create } = setup({
      existing: { lotId: "lot-9", saleId: OTHER_SALE_ID, status: "draft" },
    });
    const outcome = await service.createDraft(request);
    expect(outcome).toMatchObject({
      ok: false,
      status: 409,
      refusal: { error: "already_drafted" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("recovers when two requests race and the database keeps only one lot", async () => {
    const { service, findOpenLotForRegister } = setup({
      create: () => {
        throw new Error(
          'duplicate key value violates unique constraint "lot_artwork_register_open_uid"',
        );
      },
    });
    findOpenLotForRegister
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lotId: "lot-race", saleId: SALE_ID, status: "draft" });
    expect(await service.createDraft(request)).toEqual({
      ok: true,
      data: { lotId: "lot-race", saleId: SALE_ID, created: false },
    });
  });

  it("refuses a sale that is not open for new lots", async () => {
    const { service, create } = setup({ sales: [] });
    expect(await service.createDraft(request)).toMatchObject({
      ok: false,
      status: 409,
      refusal: { error: "sale_not_open" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses an artwork the register does not know, a print, and one sold or in a private sale", async () => {
    expect(await setup({ register: null }).service.createDraft(request)).toMatchObject({
      status: 404,
      refusal: { error: "register_not_found" },
    });
    expect(
      await setup({ register: entry({ kind: "print" }) }).service.createDraft(request),
    ).toMatchObject({ status: 409, refusal: { error: "artwork_offered_elsewhere" } });
    const sold = await setup({
      register: entry({ offer: { state: "sold", ref: { kind: "shop_artwork", id: "a" } } }),
    }).service.createDraft(request);
    expect(sold).toMatchObject({ status: 409 });
    expect((sold as { refusal: { message: string } }).refusal.message).toMatch(/has been sold/);
    const soldInGallery = await setup({
      register: entry({ offer: { state: "sold", ref: { kind: "gallery_sale", id: "z-1" } } }),
    }).service.createDraft(request);
    expect((soldInGallery as { refusal: { message: string } }).refusal.message).toMatch(
      /sold in the gallery/,
    );
    const privateSale = await setup({
      register: entry({ offer: { state: "private_sale", ref: { kind: "private_sale", id: "p" } } }),
    }).service.createDraft(request);
    expect((privateSale as { refusal: { message: string } }).refusal.message).toMatch(
      /private sale/,
    );
  });

  it("allows an artwork that is still on lax.art (the move withdraws it) or held", async () => {
    for (const state of ["lax_art", "held", "withdrawn"] as const) {
      const ref = state === "lax_art" ? { kind: "shop_artwork" as const, id: "s" } : null;
      const { service } = setup({ register: entry({ offer: { state, ref } }) });
      expect((await service.createDraft(request)).ok).toBe(true);
    }
  });

  it("says so when LAX Bid has no house seller account", async () => {
    const { service, create } = setup({ seller: null });
    expect(await service.createDraft(request)).toMatchObject({
      ok: false,
      status: 503,
      refusal: { error: "not_configured" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("passes on the lot service's refusal in words for staff", async () => {
    const { service } = setup({
      create: () => err(new LotError("Lots cannot be added to this sale.")),
    });
    expect(await service.createDraft(request)).toMatchObject({
      ok: false,
      refusal: { error: "sale_not_open", message: "Lots cannot be added to this sale." },
    });
  });
});
