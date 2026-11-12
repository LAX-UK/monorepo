import {
  type ArtworkRegisterEntry,
  InventoryPeerRefusedError,
  type LotCatalogueFacts,
} from "@auction/artwork-register-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import { CatalogueCopyRefusedError } from "../ports/catalogue-change.ports.js";
import { CatalogueChangeService } from "./catalogue-change.service.js";

const REGISTER_ID = "2f0b6d7e-0000-4000-8000-000000000001";
const T0 = new Date("2026-11-03T09:00:00.000Z");

const entry = (patch: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry => ({
  id: REGISTER_ID,
  zohoProductId: "5001",
  stockCode: "LAX-ORI-AR-TM-26-0004",
  kind: "original",
  sourceOriginalId: null,
  title: "Tidal margin V",
  artist: { zohoArtistId: "77", name: "Ada Rowe", code: "AR" },
  medium: "Oil on linen",
  dimensions: "90 × 120 cm",
  year: 2024,
  imageRefs: ["a.jpg"],
  catalogueStatus: "Available",
  offer: { state: "held", ref: null },
  zohoModifiedAt: T0,
  createdAt: T0,
  updatedAt: T0,
  version: 1,
  ...patch,
});

const lotFacts = (patch: Partial<LotCatalogueFacts> = {}): LotCatalogueFacts => ({
  lotId: "3f0b6d7e-0000-4000-8000-000000000009",
  status: "draft",
  saleStatus: "draft",
  title: "Tidal margin IV",
  medium: "Oil on linen",
  dimensions: "90 × 120 cm",
  imageUrls: ["https://img/a.jpg"],
  ...patch,
});

const listingFacts = (published: boolean, title = "Tidal margin IV") => ({
  artworkId: "4f0b6d7e-0000-4000-8000-000000000003",
  published,
  facts: {
    title,
    artistId: "artist-1",
    artistName: "Ada Rowe",
    artistCode: "AR",
    medium: "Oil on linen",
    dimensions: "90 × 120 cm",
    year: 2024,
    imageKeys: ["a.jpg"],
  },
  artistForCode: { artistId: "artist-1", displayName: "Ada Rowe", archived: false },
});

function build(
  over: {
    found?: ArtworkRegisterEntry | null;
    listing?: ReturnType<typeof listingFacts> | null;
    lot?: LotCatalogueFacts | null;
  } = {},
) {
  const { found = entry(), listing = null, lot = null } = over;
  const updateDraft = vi.fn(async () => ({ updated: ["Title"] }));
  const updateLotCatalogue = vi.fn(async () => ({ lotId: lotFacts().lotId }));
  const audit = { append: vi.fn(async () => undefined) };
  const service = new CatalogueChangeService({
    register: { findById: vi.fn(async () => found) },
    laxArt: { read: vi.fn(async () => listing), updateDraft },
    bid: { findLotCatalogue: vi.fn(async () => lot), updateLotCatalogue },
    resolveImageUrl: (value) => (value ? `https://img/${value}` : null),
    audit,
  });
  return { service, updateDraft, updateLotCatalogue, audit };
}

describe("CatalogueChangeService.changesFor", () => {
  it("lists each copy that no longer matches Zoho", async () => {
    const { service } = build({ listing: listingFacts(false), lot: lotFacts() });
    const changes = await service.changesFor(entry());
    expect(changes.map((change) => [change.copy, change.state, change.canUpdate])).toEqual([
      ["lax_art", "draft", true],
      ["bid_lot", "draft", true],
    ]);
  });

  it("lists nothing when the copies match, or there are none", async () => {
    expect(await build().service.changesFor(entry())).toEqual([]);
    const matching = build({
      listing: listingFacts(false, "Tidal margin V"),
      lot: lotFacts({ title: "Tidal margin V" }),
    });
    expect(await matching.service.changesFor(entry())).toEqual([]);
  });

  it("reads a lot LAX Bid cannot answer for as matching, never as an error", async () => {
    const { service } = build();
    const failing = new CatalogueChangeService({
      register: { findById: async () => entry() },
      laxArt: { read: async () => null, updateDraft: vi.fn() },
      bid: {
        findLotCatalogue: async () => {
          throw new Error("down");
        },
        updateLotCatalogue: vi.fn(),
      },
      resolveImageUrl: () => null,
      audit: { append: async () => undefined },
    });
    expect(await failing.changesFor(entry())).toEqual([]);
    expect(service).toBeDefined();
  });

  it("never reports a Bid lot for a print", async () => {
    const { service } = build({ lot: lotFacts() });
    expect(await service.changesFor(entry({ kind: "print" }))).toEqual([]);
  });
});

describe("CatalogueChangeService.update", () => {
  it("brings a draft lax.art listing up to date and says which fields changed", async () => {
    const { service, updateDraft } = build({ listing: listingFacts(false) });
    const result = await service.update({
      registerId: REGISTER_ID,
      copy: "lax_art",
      actorSubjectId: "u1",
    });
    expect(result).toEqual({ copy: "lax_art", updated: ["Title"] });
    expect(updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ zohoProductId: "5001", actorSubjectId: "u1" }),
    );
  });

  it("says so when the listing has been published since the page was drawn", async () => {
    const { service, updateDraft } = build({ listing: listingFacts(false) });
    updateDraft.mockRejectedValueOnce(
      new CatalogueCopyRefusedError("This listing is live on lax.art."),
    );
    await expect(
      service.update({ registerId: REGISTER_ID, copy: "lax_art", actorSubjectId: "u1" }),
    ).rejects.toThrow(ShopDomainError);
  });

  it("gives a draft Bid lot Zoho's details and records who did it", async () => {
    const { service, updateLotCatalogue, audit } = build({ lot: lotFacts() });
    const result = await service.update({
      registerId: REGISTER_ID,
      copy: "bid_lot",
      actorSubjectId: "u1",
    });
    expect(result).toEqual({ copy: "bid_lot", updated: ["Title"] });
    expect(updateLotCatalogue).toHaveBeenCalledWith(REGISTER_ID, {
      actor: "staff:u1",
      content: {
        title: "Tidal margin V",
        medium: "Oil on linen",
        dimensions: "90 × 120 cm",
        imageUrls: ["https://img/a.jpg"],
      },
    });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorSubjectId: "u1",
        action: "zoho_catalogue_update",
        targetType: "bid_lot",
        targetId: lotFacts().lotId,
        afterJson: expect.objectContaining({ updated: ["Title"] }),
      }),
    );
  });

  it.each([
    ["scheduled", { status: "scheduled" as const }],
    ["live", { status: "active" as const, saleStatus: "active" }],
    ["upcoming sale", { saleStatus: "scheduled" }],
  ])("never changes a %s Bid lot, and never asks LAX Bid to", async (_name, patch) => {
    const { service, updateLotCatalogue, audit } = build({ lot: lotFacts(patch) });
    await expect(
      service.update({ registerId: REGISTER_ID, copy: "bid_lot", actorSubjectId: "u1" }),
    ).rejects.toThrow(/live or coming up/);
    expect(updateLotCatalogue).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });

  it("changes nothing, and records nothing, when the draft lot already matches", async () => {
    const { service, updateLotCatalogue, audit } = build({
      lot: lotFacts({ title: "Tidal margin V" }),
    });
    const result = await service.update({
      registerId: REGISTER_ID,
      copy: "bid_lot",
      actorSubjectId: "u1",
    });
    expect(result.updated).toEqual([]);
    expect(updateLotCatalogue).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });

  it("passes on LAX Bid's refusal in its own words", async () => {
    const { service, updateLotCatalogue } = build({ lot: lotFacts() });
    updateLotCatalogue.mockRejectedValueOnce(
      new InventoryPeerRefusedError({ error: "lot_not_draft", message: "Not a draft." }, 409),
    );
    await expect(
      service.update({ registerId: REGISTER_ID, copy: "bid_lot", actorSubjectId: "u1" }),
    ).rejects.toThrow("Not a draft.");
  });

  it("refuses an artwork or lot that is not there", async () => {
    await expect(
      build({ found: null }).service.update({
        registerId: REGISTER_ID,
        copy: "lax_art",
        actorSubjectId: "u1",
      }),
    ).rejects.toThrow();
    await expect(
      build().service.update({ registerId: REGISTER_ID, copy: "bid_lot", actorSubjectId: "u1" }),
    ).rejects.toThrow("no lot in LAX Bid");
  });
});
