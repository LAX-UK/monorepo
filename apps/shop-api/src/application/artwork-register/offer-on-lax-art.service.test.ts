import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import {
  type CreateLaxArtDraftCommand,
  LaxArtArtistRefusedError,
  LaxArtOfferRefusedError,
} from "../ports/offer-on-lax-art.ports.js";
import { laxArtOfferBlockers } from "./lax-art-offer-blockers.js";
import { type OfferOnLaxArtDeps, OfferOnLaxArtService } from "./offer-on-lax-art.service.js";

const REGISTER_ID = "2f0b6d7e-0000-4000-8000-000000000001";
const ARTIST_ID = "3f0b6d7e-0000-4000-8000-000000000002";
const ARTWORK_ID = "4f0b6d7e-0000-4000-8000-000000000003";
const T0 = new Date("2026-11-03T09:00:00.000Z");

function entry(overrides: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry {
  return {
    id: REGISTER_ID,
    zohoProductId: "5001",
    stockCode: "LAX-ORI-AR-TM-26-0004",
    kind: "original",
    sourceOriginalId: null,
    title: "Tidal margin IV",
    artist: { zohoArtistId: "77", name: "Ada Rowe", code: "AR" },
    medium: "Oil on linen",
    dimensions: "90 × 120 cm",
    year: 2024,
    imageRefs: ["a.jpg", "b.jpg", "c.jpg"],
    catalogueStatus: "Available",
    offer: { state: "held", ref: null },
    zohoModifiedAt: T0,
    createdAt: T0,
    updatedAt: T0,
    version: 1,
    ...overrides,
  };
}

function build(
  overrides: Partial<OfferOnLaxArtDeps> & { found?: ArtworkRegisterEntry | null } = {},
) {
  const { found = entry(), ...rest } = overrides;
  const createDraft = vi.fn(async (_command: CreateLaxArtDraftCommand) => ({
    artworkId: ARTWORK_ID,
    slug: "ada-rowe-tidal-margin-iv",
    created: true,
  }));
  const deps: OfferOnLaxArtDeps = {
    register: { findById: vi.fn(async () => found) },
    artists: {
      findByZohoArtistCode: vi.fn(async () => ({
        artistId: ARTIST_ID,
        displayName: "Ada Rowe",
        archived: false,
      })),
    },
    listings: {
      findByZohoProductId: vi.fn(async () => null),
      findZohoProductId: vi.fn(async () => null),
    },
    drafts: { createDraft },
    ...rest,
  };
  return { service: new OfferOnLaxArtService(deps), deps, createDraft };
}

const body = {
  artistId: ARTIST_ID,
  saleState: "for_sale" as const,
  slug: "ada-rowe-tidal-margin-iv",
};
const offer = (service: OfferOnLaxArtService) =>
  service.offer({
    registerId: REGISTER_ID,
    body,
    actorSubjectId: "u1",
    idempotencyKey: "key-1",
  });

describe("OfferOnLaxArtService.assess", () => {
  it("is ready for a held original, with the artist matched by Zoho artist code", async () => {
    const { service, deps } = build();
    const assessment = await service.assess(REGISTER_ID);
    expect(deps.artists.findByZohoArtistCode).toHaveBeenCalledWith("AR");
    expect(assessment).toMatchObject({
      eligible: true,
      blockers: [],
      matchedArtist: { artistId: ARTIST_ID, displayName: "Ada Rowe" },
      existing: null,
      missing: [],
      imageCount: 3,
      stockCode: "LAX-ORI-AR-TM-26-0004",
    });
  });

  it("asks staff to choose the artist when none carries the code", async () => {
    const { service } = build({ artists: { findByZohoArtistCode: async () => null } });
    expect((await service.assess(REGISTER_ID)).matchedArtist).toBeNull();
  });

  it("does not match an archived artist", async () => {
    const { service } = build({
      artists: {
        findByZohoArtistCode: async () => ({
          artistId: ARTIST_ID,
          displayName: "Ada",
          archived: true,
        }),
      },
    });
    expect((await service.assess(REGISTER_ID)).matchedArtist).toBeNull();
  });

  it("lists what Zoho still lacks without blocking the draft", async () => {
    const { service } = build({ found: entry({ dimensions: null, imageRefs: [] }) });
    const assessment = await service.assess(REGISTER_ID);
    expect(assessment.eligible).toBe(true);
    expect(assessment.missing).toEqual(["image", "size"]);
  });

  it("refuses a print in words that point to LAX Shop", async () => {
    const { service } = build({ found: entry({ kind: "print", sourceOriginalId: ARTIST_ID }) });
    const assessment = await service.assess(REGISTER_ID);
    expect(assessment.eligible).toBe(false);
    expect(assessment.blockers[0]?.message).toBe(
      "Prints are sold in runs on LAX Shop, not on lax.art or at auction.",
    );
  });

  it("names every reason, most important first, when it is held elsewhere and reserved", async () => {
    const { service } = build({
      found: entry({
        catalogueStatus: "Reserved",
        offer: { state: "bid_sale", ref: { kind: "bid_lot", id: "lot-1" } },
      }),
    });
    const assessment = await service.assess(REGISTER_ID);
    expect(assessment.eligible).toBe(false);
    expect(assessment.blockers.map((blocker) => blocker.message)).toEqual([
      "This artwork is in a LAX Bid sale. Withdraw the lot there first.",
      "Zoho shows this artwork as reserved. Offer it once Zoho shows it as available.",
    ]);
  });

  it("refuses an artwork sold in the gallery", async () => {
    const { service } = build({ found: entry({ catalogueStatus: "Sold" }) });
    const assessment = await service.assess(REGISTER_ID);
    expect(assessment.blockers.map((blocker) => blocker.link?.target)).toEqual(["zoho_record"]);
  });

  it("does not block opening an artwork that already has its draft", async () => {
    const { service } = build({
      found: entry({ offer: { state: "lax_art", ref: { kind: "shop_artwork", id: ARTWORK_ID } } }),
      listings: {
        findByZohoProductId: async () => ({
          artworkId: ARTWORK_ID,
          slug: "ada-rowe-tidal-margin-iv",
          published: true,
          createdAt: T0.toISOString(),
        }),
        findZohoProductId: async () => null,
      },
    });
    const assessment = await service.assess(REGISTER_ID);
    expect(assessment).toMatchObject({
      eligible: true,
      existing: { artworkId: ARTWORK_ID, published: true },
    });
  });

  it("answers 404 for an unknown record", async () => {
    const { service } = build({ found: null });
    await expect(service.assess(REGISTER_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("OfferOnLaxArtService.offer", () => {
  it("makes the draft from the register entry for the chosen artist", async () => {
    const { service, createDraft } = build();
    await expect(offer(service)).resolves.toEqual({
      artworkId: ARTWORK_ID,
      slug: "ada-rowe-tidal-margin-iv",
      created: true,
    });
    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        entry: expect.objectContaining({ id: REGISTER_ID }),
        artistId: ARTIST_ID,
        saleState: "for_sale",
        slug: "ada-rowe-tidal-margin-iv",
        actorSubjectId: "u1",
        idempotencyKey: "key-1",
      }),
    );
  });

  it("returns the same draft when asked again", async () => {
    const same = { artworkId: ARTWORK_ID, slug: "ada-rowe-tidal-margin-iv", created: false };
    const { service } = build({ drafts: { createDraft: vi.fn(async () => same) } });
    await expect(offer(service)).resolves.toEqual(same);
  });

  it("turns a refusal from the register into the lock's words", async () => {
    const blockers = laxArtOfferBlockers(
      entry({ offer: { state: "private_sale", ref: { kind: "private_sale", id: "ps-1" } } }),
      { kind: "shop_artwork", id: ARTWORK_ID },
    );
    const { service } = build({
      drafts: {
        createDraft: vi.fn(async () => {
          throw new LaxArtOfferRefusedError(blockers);
        }),
      },
    });
    await expect(offer(service)).rejects.toEqual(
      new ShopDomainError("This artwork is in a private sale. Withdraw it there first."),
    );
  });

  it("tells staff when the chosen artist cannot take the artwork", async () => {
    const { service } = build({
      drafts: {
        createDraft: vi.fn(async () => {
          throw new LaxArtArtistRefusedError("That artist is archived. Restore the artist first.");
        }),
      },
    });
    await expect(offer(service)).rejects.toEqual(
      new ShopDomainError("That artist is archived. Restore the artist first."),
    );
  });

  it("lets other failures through untouched", async () => {
    const failure = new Error("database down");
    const { service } = build({
      drafts: {
        createDraft: vi.fn(async () => {
          throw failure;
        }),
      },
    });
    await expect(offer(service)).rejects.toBe(failure);
  });

  it("answers 404 for an unknown record without making anything", async () => {
    const { service, createDraft } = build({ found: null });
    await expect(offer(service)).rejects.toMatchObject({ statusCode: 404 });
    expect(createDraft).not.toHaveBeenCalled();
  });
});
