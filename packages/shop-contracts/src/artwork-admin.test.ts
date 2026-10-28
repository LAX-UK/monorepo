import "./contract-formats.js";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { describe, expect, it } from "vitest";
import {
  AdminArtistCreateBodySchema,
  AdminArtworkBulkVisibilityBodySchema,
  AdminArtworkCreateBodySchema,
  AdminArtworkDetailSchema,
  AdminArtworkListQuerySchema,
  AdminArtworkListSchema,
  AdminArtworkUpdateBodySchema,
} from "./artwork-admin.js";
import { PublicArtworkDetailSchema, PublicArtworkSummarySchema } from "./artwork-public.js";

const ARTWORK = "11111111-1111-4111-8111-111111111111";
const ARTIST = "22222222-2222-4222-8222-222222222222";
const VERSION = "2026-03-01T10:00:00.000Z";

const editable = {
  title: "Harbour at Dusk",
  artistId: ARTIST,
  yearCreated: 2024,
  medium: "Oil on linen",
  dimensions: "60 × 80 cm",
  description: null,
  printPricePence: 45_000,
  saleState: "for_sale",
  salesChannel: "shop",
  images: [{ mediaKey: "artwork/abc.jpg", alt: "Harbour at dusk" }],
  seoTitle: null,
  seoDescription: null,
};

describe("artwork admin contracts", () => {
  describe("create", () => {
    const check = TypeCompiler.Compile(AdminArtworkCreateBodySchema);

    it("accepts a complete new artwork", () => {
      expect(
        check.Check({
          ...editable,
          slug: "harbour-at-dusk",
          run: { spec: { type: "lax_standard" } },
        }),
      ).toBe(true);
    });

    it("refuses a slug that is not a clean URL segment", () => {
      for (const slug of ["Harbour", "harbour at dusk", "-harbour", "harbour--dusk"]) {
        expect(check.Check({ ...editable, slug, run: null })).toBe(false);
      }
    });

    it("refuses a zero or negative price, and fractional pence", () => {
      for (const printPricePence of [0, -1, 12.5]) {
        expect(
          check.Check({
            ...editable,
            printPricePence,
            slug: "harbour-at-dusk",
            run: { spec: { type: "lax_standard" } },
          }),
        ).toBe(false);
      }
    });

    it("takes no price as an omitted field, never as null", () => {
      const { printPricePence: _price, ...unpriced } = editable;
      const base = { slug: "harbour-at-dusk", run: { spec: { type: "lax_standard" as const } } };
      expect(check.Check({ ...unpriced, ...base })).toBe(true);
      expect(check.Check({ ...unpriced, ...base, printPricePence: null })).toBe(false);
    });

    it("refuses unknown fields", () => {
      expect(
        check.Check({
          ...editable,
          slug: "harbour-at-dusk",
          run: null,
          publishedAt: VERSION,
        }),
      ).toBe(false);
    });
  });

  describe("update", () => {
    const check = TypeCompiler.Compile(AdminArtworkUpdateBodySchema);

    it("needs the version the editor opened", () => {
      expect(check.Check({ ...editable, expectedVersion: VERSION })).toBe(true);
      expect(check.Check(editable)).toBe(false);
    });

    it("cannot change the slug or the edition run", () => {
      expect(check.Check({ ...editable, expectedVersion: VERSION, slug: "renamed" })).toBe(false);
      expect(check.Check({ ...editable, expectedVersion: VERSION, run: null })).toBe(false);
    });

    it("caps the gallery at twenty images", () => {
      const images = Array.from({ length: 21 }, (_, index) => ({
        mediaKey: `artwork/${index}.jpg`,
        alt: null,
      }));
      expect(check.Check({ ...editable, images, expectedVersion: VERSION })).toBe(false);
    });
  });

  describe("bulk visibility", () => {
    const check = TypeCompiler.Compile(AdminArtworkBulkVisibilityBodySchema);

    it("takes one action for up to a hundred distinct artworks", () => {
      expect(check.Check({ action: "publish", artworkIds: [ARTWORK] })).toBe(true);
      expect(check.Check({ action: "publish", artworkIds: [] })).toBe(false);
      expect(check.Check({ action: "publish", artworkIds: [ARTWORK, ARTWORK] })).toBe(false);
      expect(check.Check({ action: "delete", artworkIds: [ARTWORK] })).toBe(false);
    });
  });

  describe("list", () => {
    it("filters by view, artist, sale state and channel", () => {
      const check = TypeCompiler.Compile(AdminArtworkListQuerySchema);
      expect(
        check.Check({ state: "draft", artistId: ARTIST, saleState: "sold", salesChannel: "art" }),
      ).toBe(true);
      expect(check.Check({ state: "deleted" })).toBe(false);
    });

    it("carries counts per view and staff edition figures", () => {
      const check = TypeCompiler.Compile(AdminArtworkListSchema);
      expect(
        check.Check({
          items: [
            {
              artworkId: ARTWORK,
              slug: "harbour-at-dusk",
              title: "Harbour at Dusk",
              artistId: ARTIST,
              artistName: "Ada Artist",
              thumbnailUrl: null,
              editionSize: 24,
              run: {
                spec: { type: "lax_standard" },
                factsStatus: "needs_review",
                factsLocked: false,
              },
              soldEditionCount: 3,
              printPricePence: 45_000,
              saleState: "for_sale",
              salesChannel: "shop",
              state: "live",
              updatedAt: VERSION,
            },
          ],
          nextCursor: null,
          counts: { live: 1, draft: 0, sold_out: 0, archived: 0 },
        }),
      ).toBe(true);
    });
  });

  it("describes an artwork with its edition counts for staff", () => {
    const check = TypeCompiler.Compile(AdminArtworkDetailSchema);
    expect(
      check.Check({
        artworkId: ARTWORK,
        slug: "harbour-at-dusk",
        title: "Harbour at Dusk",
        artist: {
          artistId: ARTIST,
          slug: "ada-artist",
          displayName: "Ada Artist",
          archived: false,
        },
        yearCreated: 2024,
        medium: null,
        dimensions: null,
        description: null,
        run: null,
        printPricePence: null,
        saleState: "for_sale",
        salesChannel: "shop",
        seoTitle: null,
        seoDescription: null,
        images: [],
        importedImageUrl: null,
        editions: {
          size: 24,
          committed: 0,
          byStatus: {
            not_authorised: 24,
            authorised: 0,
            reserved: 0,
            held: 0,
            sold: 0,
            withdrawn: 0,
          },
          byAllocation: { original_buyer_entitlement: 10, artist: 10, lax: 4 },
        },
        state: "draft",
        publishBlockers: ["no_image", "no_edition_price"],
        publishedAt: null,
        archivedAt: null,
        createdAt: VERSION,
        updatedAt: VERSION,
        version: VERSION,
      }),
    ).toBe(true);
  });

  it("creates an artist from a name and a slug", () => {
    const check = TypeCompiler.Compile(AdminArtistCreateBodySchema);
    expect(check.Check({ displayName: "Ada Artist", slug: "ada-artist", discipline: null })).toBe(
      true,
    );
    expect(check.Check({ displayName: "", slug: "ada-artist", discipline: null })).toBe(false);
  });
});

describe("public catalogue responses", () => {
  const remainingCountFields = [
    "availableEditionCount",
    "remainingEditions",
    "soldEditionCount",
    "editions",
  ];

  it.each([
    ["summary", PublicArtworkSummarySchema],
    ["detail", PublicArtworkDetailSchema],
  ] as const)("never describe remaining edition counts in the %s", (_name, schema) => {
    for (const field of remainingCountFields) {
      expect(Object.keys(schema.properties)).not.toContain(field);
    }
    expect(Object.keys(schema.properties.availability.properties).sort()).toEqual([
      "state",
      "totalEditions",
    ]);
  });
});
