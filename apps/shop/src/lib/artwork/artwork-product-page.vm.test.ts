import type {
  PublicArtistDetail,
  PublicArtworkDetail,
  PublicArtworkEdition,
  PublicArtworkSummary,
} from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { addToBasketErrorMessage } from "./add-to-basket-error";
import {
  buildArtworkProductPage,
  buildGalleryImages,
  buildMoreBy,
  selectMoreByEditions,
} from "./artwork-product-page.vm";

function summary(overrides: Partial<PublicArtworkSummary> = {}): PublicArtworkSummary {
  return {
    slug: "warm-basket",
    title: "Warm Basket",
    artistName: "Emmett King",
    artistSlug: "emmett-king",
    imageUrl: "/warm-basket.webp",
    saleState: "for_sale",
    dimensions: null,
    medium: "Giclée print",
    yearCreated: 2025,
    salesChannel: "shop",
    eligibleForEditionAllocation: true,
    printPricePence: 12_000,
    availability: { totalEditions: 24, state: "available" },
    ...overrides,
  };
}

function detail(overrides: Partial<PublicArtworkDetail> = {}): PublicArtworkDetail {
  return {
    ...summary(),
    description: "  A still life.  ",
    images: [],
    heightCm: 50,
    widthCm: 40,
    depthCm: null,
    hasCertificate: true,
    ...overrides,
  };
}

function artist(overrides: Partial<PublicArtistDetail> = {}): PublicArtistDetail {
  return {
    slug: "emmett-king",
    name: "Emmett King",
    discipline: null,
    portraitUrl: null,
    artworkCount: 3,
    bio: null,
    shortBio: null,
    ...overrides,
  } as PublicArtistDetail;
}

const ART = new URL("https://www.thelax.art/");

const handSigned = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
} as const;

const unsigned = {
  numbering: "none",
  signature: { kind: "unsigned" },
  certificate: { kind: "none" },
} as const;

function limited(overrides: Partial<PublicArtworkEdition> = {}): PublicArtworkEdition {
  return {
    run: { kind: "limited", size: 24 },
    facts: handSigned,
    proofsKept: { ap: 0, pp: 0, hc: 0 },
    otherRuns: [],
    ...overrides,
  };
}

function page(
  artwork: PublicArtworkDetail,
  extra: Partial<Parameters<typeof buildArtworkProductPage>[0]> = {},
) {
  return buildArtworkProductPage({ artwork, artistEditions: [], artBaseUrl: ART, ...extra });
}

const more = (n: number, availability: "available" | "sold_out" = "available") =>
  Array.from({ length: n }, (_, i) =>
    summary({
      slug: `other-${availability}-${i}`,
      title: `Other ${i}`,
      availability: { totalEditions: 24, state: availability },
    }),
  );

describe("product page view model", () => {
  it("offers every image the API returns, in order, with the primary as a fallback", () => {
    expect(
      buildGalleryImages(
        detail({
          images: [
            { url: "/a.webp", alt: "Front", caption: null, blurDataUrl: null },
            { url: "/b.webp", alt: null, caption: null, blurDataUrl: null },
            { url: "/a.webp", alt: "Duplicate", caption: null, blurDataUrl: null },
          ],
        }),
      ),
    ).toEqual([
      { url: "/a.webp", alt: "Front" },
      { url: "/b.webp", alt: "Warm Basket by Emmett King" },
    ]);
    expect(buildGalleryImages(detail())).toEqual([
      { url: "/warm-basket.webp", alt: "Warm Basket by Emmett King" },
    ]);
    expect(buildGalleryImages(detail({ imageUrl: null }))).toEqual([]);
  });

  it("heads the buy column: the eyebrow from the facts, the title with its year, the artist", () => {
    const vm = page(
      detail({
        edition: limited(),
        yearCreated: 2025,
        medium: "Giclée print",
        printPaper: "cotton rag",
        heightCm: 60,
        widthCm: 45,
      }),
    );
    expect(vm.eyebrow).toBe("Limited edition print");
    expect(vm.year).toBe(2025);
    expect(vm.artistHref).toBe("/artists/emmett-king");
    expect(vm.metaLine).toBe("Giclée print on cotton rag · 60 × 45 cm (23.6 × 17.7 in)");
  });

  it("words the eyebrow for an open edition and an artist's proof from the contract", () => {
    expect(
      page(detail({ edition: limited({ run: { kind: "open" }, facts: unsigned }) })).eyebrow,
    ).toBe("Open edition print");
    expect(
      page(detail({ edition: limited({ run: { kind: "proof", proofType: "ap", size: 3 } }) }))
        .eyebrow,
    ).toBe("Artist's proof");
  });

  it("leaves the meta line to what is known", () => {
    expect(page(detail({ medium: null, heightCm: null, widthCm: null })).metaLine).toBeNull();
    expect(page(detail({ medium: "Giclée print", heightCm: null, widthCm: null })).metaLine).toBe(
      "Giclée print",
    );
  });
});

describe("sold out", () => {
  it("leaves the image unchanged and the price visible", () => {
    const soldOut = page(
      detail({ edition: limited(), availability: { totalEditions: 24, state: "sold_out" } }),
    );
    const available = page(detail({ edition: limited() }));
    expect(soldOut.gallery).toEqual(available.gallery);
    expect(soldOut.purchase?.availability).toBe("sold_out");
    expect(soldOut.eyebrow).toBe(available.eyebrow);
  });
});

describe("About this edition", () => {
  it("lists edition, signature, number and certificate, written by the shared contract", () => {
    const facts = page(detail({ edition: limited() })).facts;
    expect(facts?.rows).toEqual([
      { label: "Edition", value: "Limited edition of 24" },
      {
        label: "Signature",
        value: "Signed by hand in pencil by the artist, front lower margin",
      },
      {
        label: "Number",
        value:
          "Numbered by hand on the print. Your number appears in your order once payment is confirmed.",
      },
      {
        label: "Certificate",
        value: "Certificate of authenticity from the artist, sent with your print",
      },
    ]);
    expect(facts?.statement).toBe(
      "A limited edition is a fixed number of prints from one image. No more will be made in this size and form.",
    );
  });

  it("adds the stamp, printer and publisher rows only when they are stated, in this order", () => {
    const stated = page(
      detail({
        edition: limited({
          facts: {
            ...handSigned,
            stamp: "printer_blind",
            printedBy: "Coriander Studio, London",
            publishedBy: { kind: "named", name: "Kestrel Editions" },
          },
        }),
      }),
    ).facts;
    expect(stated?.rows.slice(4)).toEqual([
      { label: "Stamp", value: "Blind stamp of the printer" },
      { label: "Printed by", value: "Coriander Studio, London" },
      { label: "Published by", value: "Kestrel Editions" },
    ]);
    const plain = page(detail({ edition: limited({ facts: { ...handSigned, stamp: "none" } }) }));
    expect(plain.facts?.rows.map((row) => row.label)).toEqual([
      "Edition",
      "Signature",
      "Number",
      "Certificate",
    ]);
  });

  it("words a London Art Exchange certificate on the authority it stands on", () => {
    const facts = page(
      detail({
        edition: limited({
          facts: {
            ...handSigned,
            certificate: {
              kind: "included",
              issuer: "lax",
              form: "paper",
              arrives: { kind: "with_print" },
              numberedToMatch: true,
              authority: { givenBy: "artist" },
            },
          },
        }),
      }),
    ).facts;
    expect(facts?.rows.find((row) => row.label === "Certificate")?.value).toBe(
      "Certificate of authenticity issued by London Art Exchange Ltd on the artist's written authority, sent with your print",
    );
  });

  it("adds the proofs row only when proofs were kept, never a remaining count", () => {
    const kept = page(detail({ edition: limited({ proofsKept: { ap: 2, pp: 0, hc: 0 } }) })).facts;
    expect(kept?.rows.at(-1)).toEqual({
      label: "Proofs",
      value: "The artist also kept 2 artist's proofs, outside the edition of 24.",
    });
    const none = page(detail({ edition: limited() })).facts;
    expect(none?.rows.map((row) => row.label)).not.toContain("Proofs");
  });

  it("says 'Edition of 24' once on the page", () => {
    const vm = page(detail({ edition: limited() }));
    const shown = JSON.stringify([vm.eyebrow, vm.title, vm.metaLine, vm.facts, vm.about]);
    expect(shown.match(/edition of 24/gi)?.length).toBe(1);
  });

  it("has no statement or other runs for an open edition", () => {
    const facts = page(
      detail({
        edition: limited({
          run: { kind: "open" },
          facts: unsigned,
          otherRuns: [
            {
              slug: "ap",
              run: { kind: "proof", proofType: "ap", size: 3 },
              facts: handSigned,
              printPricePence: 65_000,
              availability: "available",
            },
          ],
        }),
      }),
    ).facts;
    expect(facts?.statement).toBeNull();
    expect(facts?.alsoAvailable).toEqual([]);
    expect(facts?.rows[0]).toEqual({ label: "Edition", value: "Open edition" });
    expect(facts?.rows.find((row) => row.label === "Number")?.value).toBe("Not numbered");
  });

  it("names the other runs of a limited edition with a price or 'Sold out'", () => {
    const facts = page(
      detail({
        edition: limited({
          otherRuns: [
            {
              slug: "warm-basket-ap",
              run: { kind: "proof", proofType: "ap", size: 3 },
              facts: handSigned,
              printPricePence: 65_000,
              availability: "available",
            },
            {
              slug: "warm-basket-open",
              run: { kind: "open" },
              facts: unsigned,
              printPricePence: 9_000,
              availability: "sold_out",
            },
          ],
        }),
      }),
    ).facts;
    expect(facts?.alsoAvailable).toEqual([
      {
        slug: "warm-basket-ap",
        href: "/artworks/warm-basket-ap",
        label: "As an artist's proof",
        trailing: "£650",
      },
      {
        slug: "warm-basket-open",
        href: "/artworks/warm-basket-open",
        label: "Unsigned, open edition",
        trailing: "Sold out",
      },
    ]);
  });

  describe("a print sold on its own", () => {
    const remarque = { remarque: { medium: "pencil", place: "lower_margin" } } as const;
    const ofRun = { kind: "limited", size: 24 } as const;

    it("names its number in the eyebrow and says what is different in its own row", () => {
      const vm = page(
        detail({
          edition: limited({
            setApart: {
              print: { editionNumber: 3, proofNumber: null, of: ofRun },
              exception: remarque,
            },
          }),
        }),
      );
      expect(vm.eyebrow).toBe("Limited edition print, no. 3 of 24");
      expect(vm.facts?.rows.at(-1)).toEqual({
        label: "Remarque",
        value: "An original drawing added by the artist in pencil, lower margin",
      });
      expect(vm.basketLine).toBe(
        "Limited edition of 24 · Hand-signed · Numbered · With certificate · No. 3 · With a remarque",
      );
    });

    it("is named beside the run it came from, with its own price", () => {
      const facts = page(
        detail({
          edition: limited({
            otherRuns: [
              {
                slug: "warm-basket-no-3",
                run: ofRun,
                facts: handSigned,
                printPricePence: 42_000,
                availability: "available",
                setApart: {
                  print: { editionNumber: 3, proofNumber: null, of: ofRun },
                  exception: remarque,
                },
              },
            ],
          }),
        }),
      ).facts;
      expect(facts?.alsoAvailable).toEqual([
        {
          slug: "warm-basket-no-3",
          href: "/artworks/warm-basket-no-3",
          label: "No. 3, with a remarque",
          trailing: "£420",
        },
      ]);
    });

    it("leaves every other page as it was", () => {
      const vm = page(detail({ edition: limited() }));
      expect(vm.eyebrow).toBe("Limited edition print");
      expect(vm.facts?.rows.map((row) => row.label)).not.toContain("Remarque");
    });
  });

  it("links the original on lax.art only when there is a source original to link to", () => {
    const linked = page(
      detail({ edition: limited(), sourceOriginalSlug: "warm-basket-original" }),
    ).facts;
    expect(linked?.originalOnArtHref).toBe("https://www.thelax.art/artworks/warm-basket-original");
    expect(
      page(detail({ edition: limited(), sourceOriginalSlug: null })).facts?.originalOnArtHref,
    ).toBeNull();
    expect(
      page(detail({ edition: limited(), sourceOriginalSlug: "x" }), { artBaseUrl: null }).facts
        ?.originalOnArtHref,
    ).toBeNull();
  });

  it("names only the run while the facts are unconfirmed, and falls back to the size on older APIs", () => {
    const unconfirmed = page(detail({ edition: limited({ facts: null }) })).facts;
    expect(unconfirmed?.rows).toEqual([{ label: "Edition", value: "Limited edition of 24" }]);
    const older = page(detail()).facts;
    expect(older?.rows[0]).toEqual({ label: "Edition", value: "Limited edition of 24" });
    expect(
      page(
        detail({
          eligibleForEditionAllocation: false,
          availability: { totalEditions: 0, state: "sold_out" },
        }),
      ).facts,
    ).toBeNull();
  });
});

describe("About the work and the print", () => {
  it("trims the description and lists medium, paper and sheet size, leaving out what is unknown", () => {
    const vm = page(detail({ printPaper: "Somerset Satin 410gsm", printSize: "76 × 56 cm" }));
    expect(vm.about.description).toBe("A still life.");
    expect(vm.about.rows).toEqual([
      { label: "Medium", value: "Giclée print" },
      { label: "Paper", value: "Somerset Satin 410gsm" },
      { label: "Sheet size", value: "76 × 56 cm" },
    ]);
    expect(page(detail({ medium: null, description: null })).about).toEqual({
      description: null,
      rows: [],
    });
  });
});

describe("About the artist", () => {
  it("counts the artist's editions and links lax.art when it is configured", () => {
    const vm = page(detail(), {
      artistEditionCount: 7,
      artistDetail: artist({ shortBio: " Paints. " }),
    });
    expect(vm.artist).toMatchObject({
      name: "Emmett King",
      href: "/artists/emmett-king",
      bio: "Paints.",
      editionsLabel: "Editions by Emmett King (7)",
      laxArtHref: "https://www.thelax.art/artists/emmett-king",
      laxArtLabel: "Profile on lax.art",
    });
    expect(page(detail(), { artBaseUrl: null }).artist.laxArtHref).toBeNull();
  });

  it("has no bio or portrait without a profile", () => {
    const vm = page(detail(), { artistDetail: null });
    expect(vm.artist.bio).toBeNull();
    expect(vm.artist.portraitUrl).toBeNull();
    expect(vm.artist.editionsLabel).toBe("Editions by Emmett King (0)");
  });
});

describe("More by the artist", () => {
  const input = {
    slug: "warm-basket",
    artistName: "Emmett King",
    artistHref: "/artists/emmett-king",
  };

  it("puts available editions first and leaves this one out", () => {
    const items = [...more(1, "sold_out"), summary(), ...more(2, "available")];
    expect(selectMoreByEditions("warm-basket", items).map((item) => item.slug)).toEqual([
      "other-available-0",
      "other-available-1",
      "other-sold_out-0",
    ]);
  });

  it("is hidden with no other edition", () => {
    expect(buildMoreBy({ ...input, artistEditions: [summary()] })).toBeNull();
  });

  it("pairs one other edition with a text tile", () => {
    const vm = buildMoreBy({ ...input, artistEditions: [summary(), ...more(1)] });
    expect(vm?.items).toHaveLength(1);
    expect(vm?.tile).toEqual({
      label: "1 more edition by Emmett King",
      href: "/artists/emmett-king",
    });
    expect(vm?.allLink).toBeNull();
  });

  it("makes a row of two or three", () => {
    const vm = buildMoreBy({ ...input, artistEditions: more(3) });
    expect(vm?.items).toHaveLength(3);
    expect(vm?.tile).toBeNull();
    expect(vm?.allLink).toBeNull();
  });

  it("makes a row of four then 'All N editions' for four or more", () => {
    const vm = buildMoreBy({ ...input, artistEditions: more(5), artistEditionCount: 12 });
    expect(vm?.items).toHaveLength(4);
    expect(vm?.allLink).toEqual({
      label: "All 12 editions by Emmett King",
      href: "/artists/emmett-king",
    });
    expect(buildMoreBy({ ...input, artistEditions: more(5) })?.allLink?.label).toBe(
      "All 6 editions by Emmett King",
    );
  });
});

describe("add to basket errors", () => {
  it("says an edition sold out without any count, and asks a guest to sign in", () => {
    const soldOut = addToBasketErrorMessage({
      error: "commerce_upstream_failed",
      code: "shop.out_of_stock",
      message: "Insufficient stock",
    });
    expect(soldOut.message).toBe(
      "This edition has just sold out, so it could not be added to your basket.",
    );
    expect(soldOut.message).not.toMatch(/\d/);
    expect(addToBasketErrorMessage({ error: "sign_in_required" })).toEqual({
      message: "Sign in to add this edition to your basket.",
      signIn: true,
    });
    expect(addToBasketErrorMessage(null).message).toBe(
      "We could not add this edition to your basket. Try again.",
    );
  });
});
