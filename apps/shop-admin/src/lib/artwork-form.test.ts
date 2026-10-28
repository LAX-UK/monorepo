import { ARTWORK_SLUG_IN_USE_MESSAGE, type AdminArtworkDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  EMPTY_ARTIST_FORM,
  buildArtistCreateBody,
  validateArtistForm,
  withArtistName,
} from "./artist-form";
import {
  type ArtworkFormImage,
  type ArtworkFormValues,
  appendImages,
  artworkConflictField,
  artworkErrorSummary,
  artworkFormValues,
  buildArtworkCreateBody,
  buildArtworkUpdateBody,
  emptyArtworkForm,
  isArtworkFormDirty,
  makePrimaryImage,
  moveImage,
  parseArtworkPrice,
  removeImage,
  validateArtworkForm,
  withTitle,
} from "./artwork-form";

const ARTIST = "22222222-2222-4222-8222-222222222222";
const create = { mode: "create", canSetPrice: true, live: false, currentYear: 2026 } as const;
const edit = { ...create, mode: "edit" } as const;

function filled(patch: Partial<ArtworkFormValues> = {}): ArtworkFormValues {
  return {
    ...emptyArtworkForm(),
    title: "Harbour at Dusk",
    slug: "harbour-at-dusk",
    artistId: ARTIST,
    artistName: "Ada Artist",
    priceText: "450",
    ...patch,
  };
}

const STANDARD = { spec: { type: "lax_standard" as const } };

const detail: AdminArtworkDetail = {
  artworkId: "11111111-1111-4111-8111-111111111111",
  slug: "harbour-at-dusk",
  title: "Harbour at Dusk",
  artist: { artistId: ARTIST, slug: "ada-artist", displayName: "Ada Artist", archived: false },
  yearCreated: 2024,
  medium: "Oil on linen",
  dimensions: null,
  description: null,
  run: {
    spec: { type: "lax_standard" },
    proofsKept: { ap: 0, pp: 0, hc: 0, bat: 0 },
    locks: { sizeAndAllocationLocked: false, factsLocked: false },
    facts: null,
    factsConfirmed: null,
    factsVersion: null,
    paidOrderCount: 0,
    affectedOrders: [],
    mainRun: null,
    linkedListings: [],
    stock: null,
  },
  printPricePence: 125_000,
  saleState: "for_sale",
  salesChannel: "shop",
  seoTitle: null,
  seoDescription: null,
  images: [{ mediaKey: "artwork/a.jpg", url: "/a.jpg", alt: null }],
  importedImageUrl: null,
  editions: {
    size: 24,
    committed: 0,
    byStatus: { not_authorised: 24, authorised: 0, reserved: 0, held: 0, sold: 0, withdrawn: 0 },
    byAllocation: { original_buyer_entitlement: 10, artist: 10, lax: 4 },
  },
  state: "live",
  publishBlockers: [],
  publishedAt: "2026-03-01T10:00:00.000Z",
  archivedAt: null,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  version: "2026-03-01T10:00:00.000Z",
};

describe("artwork price", () => {
  it.each([
    ["450", 45_000],
    ["£1,250.50", 125_050],
    ["0.01", 1],
    ["", null],
    ["  ", null],
  ])("reads %j as %j pence", (text, pence) => {
    expect(parseArtworkPrice(text)).toEqual({ ok: true, pence });
  });

  it.each([
    ["0", "The price must be more than £0."],
    ["12.345", "Use pounds and pence, with no more than two decimal places."],
    ["twelve", "Enter the price in pounds, such as 450 or 450.00."],
    ["100000.01", "The price can be up to £100,000.00."],
  ])("refuses %j", (text, message) => {
    expect(parseArtworkPrice(text)).toEqual({ ok: false, message });
  });
});

describe("artwork form validation", () => {
  it("passes a complete new artwork", () => {
    expect(validateArtworkForm(filled(), create)).toEqual({});
  });

  it("names every missing required field", () => {
    expect(validateArtworkForm({ ...emptyArtworkForm(), priceText: "" }, { ...create })).toEqual({
      title: "Enter the artwork's title.",
      slug: "Enter the web address slug.",
      artistId: "Choose the artist.",
    });
  });

  it("checks the slug only when creating, since it is fixed afterwards", () => {
    const values = filled({ slug: "Harbour At Dusk" });
    expect(validateArtworkForm(values, create).slug).toMatch(/lower case letters/);
    expect(validateArtworkForm(values, edit).slug).toBeUndefined();
  });

  it("accepts a year up to next year, or none", () => {
    expect(
      validateArtworkForm(filled({ yearCreated: "2027" }), create).yearCreated,
    ).toBeUndefined();
    expect(validateArtworkForm(filled({ yearCreated: "2028" }), create).yearCreated).toBe(
      "Enter a four-digit year up to 2027, or leave it blank.",
    );
    expect(validateArtworkForm(filled({ yearCreated: "24" }), create).yearCreated).toBeDefined();
  });

  it("refuses an invalid price, and a missing one on a live edition for sale", () => {
    expect(validateArtworkForm(filled({ priceText: "0" }), create).price).toBe(
      "The price must be more than £0.",
    );
    expect(validateArtworkForm(filled({ priceText: "" }), create).price).toBeUndefined();
    expect(validateArtworkForm(filled({ priceText: "" }), { ...edit, live: true }).price).toMatch(
      /Unpublish it first/,
    );
    expect(
      validateArtworkForm(filled({ priceText: "", saleState: "price_on_application" }), {
        ...edit,
        live: true,
      }).price,
    ).toBeUndefined();
  });

  it("does not check a price staff without price access cannot change", () => {
    expect(
      validateArtworkForm(filled({ priceText: "nonsense" }), { ...edit, canSetPrice: false }).price,
    ).toBeUndefined();
  });

  it("does not ask for a price on an original", () => {
    expect(
      validateArtworkForm(filled({ editionRun: "original", priceText: "0" }), create).price,
    ).toBeUndefined();
  });

  it("lists errors in page order with links to their fields", () => {
    expect(
      artworkErrorSummary({ price: "Bad price.", title: "No title.", seoTitle: "Too long." }),
    ).toEqual([
      { fieldId: "artwork-title", message: "No title." },
      { fieldId: "artwork-price", message: "Bad price." },
      { fieldId: "artwork-seoTitle", message: "Too long." },
    ]);
  });

  it("puts a taken slug on the slug field", () => {
    expect(artworkConflictField(ARTWORK_SLUG_IN_USE_MESSAGE)).toBe("slug");
    expect(artworkConflictField("Something else")).toBeNull();
  });
});

describe("artwork form payloads", () => {
  it("creates with trimmed text, pence and the chosen run", () => {
    expect(
      buildArtworkCreateBody(
        filled({ title: "  Harbour  ", medium: " ", yearCreated: "2024", priceText: "£450.50" }),
        create,
        STANDARD,
      ),
    ).toEqual({
      slug: "harbour-at-dusk",
      run: STANDARD,
      title: "Harbour",
      artistId: ARTIST,
      yearCreated: 2024,
      medium: null,
      dimensions: null,
      description: null,
      printPricePence: 45_050,
      saleState: "for_sale",
      salesChannel: "shop",
      sourceOriginalArtworkId: null,
      images: [],
      seoTitle: null,
      seoDescription: null,
    });
  });

  it("links an edition to its original, and never sends a link for an original", () => {
    const ORIGINAL = "33333333-3333-4333-8333-333333333333";
    const linked = filled({ sourceOriginalId: ORIGINAL, sourceOriginalTitle: "Harbour, original" });
    expect(buildArtworkCreateBody(linked, create, STANDARD).sourceOriginalArtworkId).toBe(ORIGINAL);
    expect(
      buildArtworkCreateBody({ ...linked, editionRun: "original" }, create, STANDARD)
        .sourceOriginalArtworkId,
    ).toBeNull();

    const stored = artworkFormValues({
      ...detail,
      sourceOriginal: { artworkId: ORIGINAL, slug: "harbour-original", title: "Harbour, original" },
    });
    expect(stored.sourceOriginalId).toBe(ORIGINAL);
    expect(stored.sourceOriginalTitle).toBe("Harbour, original");
    expect(isArtworkFormDirty({ ...stored, sourceOriginalId: null }, stored)).toBe(true);
    expect(artworkFormValues(detail).sourceOriginalId).toBeNull();
  });

  it("never sends a price for an original, and omits a blank one", () => {
    expect(
      buildArtworkCreateBody(filled({ editionRun: "original" }), create, null),
    ).not.toHaveProperty("printPricePence");
    expect(buildArtworkCreateBody(filled({ priceText: "" }), create, STANDARD)).not.toHaveProperty(
      "printPricePence",
    );
  });

  it("keeps the stored price when staff cannot set prices", () => {
    const values = filled({ priceText: "1" });
    expect(buildArtworkUpdateBody(values, { canSetPrice: false }, 125_000).printPricePence).toBe(
      125_000,
    );
    expect(buildArtworkUpdateBody(values, { canSetPrice: true }, 125_000).printPricePence).toBe(
      100,
    );
  });

  it("round-trips a stored artwork without reporting changes", () => {
    const values = artworkFormValues(detail);
    expect(values.priceText).toBe("1,250.00");
    expect(isArtworkFormDirty(values, artworkFormValues(detail))).toBe(false);
    expect(isArtworkFormDirty({ ...values, title: `${values.title}  ` }, values)).toBe(false);
    expect(isArtworkFormDirty({ ...values, priceText: "1250" }, values)).toBe(false);
    expect(isArtworkFormDirty({ ...values, priceText: "1251" }, values)).toBe(true);
    expect(buildArtworkUpdateBody(values, { canSetPrice: true }, 125_000).images).toEqual([
      { mediaKey: "artwork/a.jpg", alt: null },
    ]);
  });

  it("fills the slug from the title until staff edit it", () => {
    const typed = withTitle(emptyArtworkForm(), "Café at Dusk, No. 2");
    expect(typed.slug).toBe("cafe-at-dusk-no-2");
    const taken = withTitle({ ...typed, slug: "my-slug", slugEdited: true }, "Other");
    expect(taken.slug).toBe("my-slug");
  });
});

describe("artwork images", () => {
  const images: ArtworkFormImage[] = ["a", "b", "c"].map((key) => ({
    mediaKey: key,
    url: null,
    alt: "",
  }));
  const keys = (list: typeof images) => list.map((image) => image.mediaKey);

  it("moves an image up or down and stays put at the ends", () => {
    expect(keys(moveImage(images, 1, -1))).toEqual(["b", "a", "c"]);
    expect(keys(moveImage(images, 1, 1))).toEqual(["a", "c", "b"]);
    expect(keys(moveImage(images, 0, -1))).toEqual(["a", "b", "c"]);
    expect(keys(moveImage(images, 2, 1))).toEqual(["a", "b", "c"]);
  });

  it("makes an image primary by moving it first", () => {
    expect(keys(makePrimaryImage(images, 2))).toEqual(["c", "a", "b"]);
  });

  it("removes and appends without duplicates", () => {
    expect(keys(removeImage(images, 0))).toEqual(["b", "c"]);
    expect(
      keys(
        appendImages(images, [
          images[0] as (typeof images)[number],
          { mediaKey: "d", url: null, alt: "" },
        ]),
      ),
    ).toEqual(["a", "b", "c", "d"]);
  });
});

describe("artist form", () => {
  it("fills the slug from the name and builds the body", () => {
    const values = withArtistName(EMPTY_ARTIST_FORM, "  Ada Lovelace ");
    expect(values.slug).toBe("ada-lovelace");
    expect(validateArtistForm(values)).toEqual({});
    expect(buildArtistCreateBody({ ...values, discipline: " " })).toEqual({
      displayName: "Ada Lovelace",
      slug: "ada-lovelace",
      discipline: null,
    });
  });

  it("asks for a name and a clean slug", () => {
    expect(validateArtistForm({ ...EMPTY_ARTIST_FORM, slug: "Ada Lovelace" })).toEqual({
      displayName: "Enter the artist's name.",
      slug: "Use lower case letters, numbers and single hyphens, such as ada-lovelace.",
    });
  });
});
