import { describe, expect, it } from "vitest";
import { computeZohoListing } from "./compute-zoho-listing.js";
import {
  ARTWORK_ID,
  LOT_ID,
  REGISTER_ID,
  factsFor,
  laxArtListing,
  links,
  lotIn,
} from "./listing-facts.fixture.js";

const NOW = new Date("2026-11-05T12:00:00Z");
const lotRef = { kind: "bid_lot", id: LOT_ID } as const;
const shopRef = { kind: "shop_artwork", id: ARTWORK_ID } as const;
const RECORD = `https://admin.lax.art/from-zoho/${REGISTER_ID}`;
const PUBLIC_LOT = `https://lax.bid/lot/harbour-at-dusk/${LOT_ID}`;
const moved = (to: "sold" | "withdrawn" | "lax_art", from: string | null, at: string) => ({
  lastMove: { at: new Date(at), from: from as never, to },
});

const compute = (facts: ReturnType<typeof factsFor>) => computeZohoListing(facts, NOW, links);

describe("computeZohoListing", () => {
  it("reads Not offered for a held artwork, linking to its register record", () => {
    expect(compute(factsFor("held"))).toEqual({
      key: "not_offered",
      value: "Not offered",
      detail: null,
      link: RECORD,
    });
  });

  it("reads a lax.art draft, linking to the staff page while buyers cannot see it", () => {
    const listing = compute(
      factsFor("held", null, { laxArt: laxArtListing({ published: false, publishedAt: null }) }),
    );
    expect(listing).toMatchObject({
      value: "Draft on lax.art",
      link: `https://admin.lax.art/artworks/${ARTWORK_ID}`,
    });
  });

  it("reads On lax.art with the public page and the date it went up", () => {
    expect(compute(factsFor("lax_art", shopRef, { laxArt: laxArtListing() }))).toEqual({
      key: "lax_art",
      value: "On lax.art",
      detail: "Published 1 Nov 2026",
      link: "https://lax.art/artworks/harbour-at-dusk",
    });
  });

  it("reads a draft lot, linking to LAX Bid's admin page", () => {
    const listing = compute(factsFor("held", null, { lot: lotIn("draft", "scheduled") }));
    expect(listing).toMatchObject({
      value: "Draft lot in LAX Bid",
      detail: "Autumn Modern · Lot 12 · draft lot",
      link: `https://lax.bid/admin/lots/${LOT_ID}`,
    });
  });

  it("follows a Bid sale through upcoming, live now and ended", () => {
    const at = (status: "scheduled" | "active" | "ended", sale: "scheduled" | "active") =>
      compute(factsFor("bid_sale", lotRef, { lot: lotIn(status, sale) }));

    expect(at("scheduled", "scheduled")).toEqual({
      key: "bid_sale_upcoming",
      value: "In a LAX Bid sale — upcoming",
      detail: "Autumn Modern · Lot 12 · starts 12 Nov 2026, 18:00",
      link: PUBLIC_LOT,
    });
    expect(at("scheduled", "active")).toMatchObject({
      value: "In a LAX Bid sale — live now",
      detail: "Autumn Modern · Lot 12 · live now, ends 14 Nov 2026, 20:00",
    });
    expect(at("active", "active").value).toBe("In a LAX Bid sale — live now");
    expect(at("ended", "active")).toMatchObject({
      value: "In a LAX Bid sale — ended",
      detail: "Autumn Modern · Lot 12 · lot closed, sold once the buyer pays",
    });
  });

  it("reads live now for a sale past its start time with no active lot, ended for an ended sale", () => {
    const withSale = (saleStatus: "scheduled" | "ended", startTime: string) => {
      const lot = lotIn("scheduled", saleStatus);
      const sale = lot.sale ? { ...lot.sale, startTime: new Date(startTime) } : null;
      return compute(factsFor("bid_sale", lotRef, { lot: { ...lot, sale } }));
    };

    expect(withSale("scheduled", "2026-11-05T18:00:00Z").value).toBe(
      "In a LAX Bid sale — upcoming",
    );
    expect(withSale("scheduled", "2026-11-05T09:00:00Z").value).toBe(
      "In a LAX Bid sale — live now",
    );
    expect(withSale("ended", "2026-11-05T09:00:00Z").value).toBe("In a LAX Bid sale — ended");
  });

  it("links a lot in a test sale to the admin page, never the public one", () => {
    const lot = lotIn("scheduled", "scheduled");
    const testLot = { ...lot, sale: lot.sale ? { ...lot.sale, isTest: true } : null };
    expect(compute(factsFor("bid_sale", lotRef, { lot: testLot })).link).toBe(
      `https://lax.bid/admin/lots/${LOT_ID}`,
    );
  });

  it("reads a private sale by its reference", () => {
    const listing = compute(
      factsFor(
        "private_sale",
        { kind: "private_sale", id: "d" },
        {
          privateSale: { id: "d", reference: "PS-0007" },
        },
      ),
    );
    expect(listing).toMatchObject({
      value: "In a private sale",
      detail: "Private sale PS-0007",
      link: RECORD,
    });
  });

  it("says a lot ATG sold was sold in LAX Bid on ATG, in the register's sold state", () => {
    const soldAt = moved("sold", "bid_sale", "2026-11-14T21:00:00Z");
    const atgLot = lotIn("ended", "ended", { soldOnAtg: true });
    expect(compute(factsFor("sold", lotRef, { lot: atgLot, ...soldAt }))).toMatchObject({
      value: "Sold in LAX Bid",
      detail: "Autumn Modern · Lot 12 · Sold in LAX Bid (ATG) · 14 Nov 2026",
      link: PUBLIC_LOT,
    });
  });

  it("recomputes the same listing from the facts however often it runs (nightly pass)", () => {
    const soldAt = moved("sold", "bid_sale", "2026-11-14T21:00:00Z");
    const facts = factsFor("sold", lotRef, {
      lot: lotIn("ended", "ended", { soldOnAtg: true }),
      ...soldAt,
    });
    expect(compute(facts)).toEqual(compute(facts));
    expect(compute(facts).detail).toContain("Sold in LAX Bid (ATG)");
    const unsold = factsFor("sold", lotRef, { lot: lotIn("ended", "ended"), ...soldAt });
    expect(compute(unsold).detail).not.toContain("ATG");
  });

  it("says a closed lot ATG sold was sold on ATG, not waiting for a buyer to pay", () => {
    const facts = factsFor("bid_sale", lotRef, {
      lot: lotIn("ended", "ended", { soldOnAtg: true }),
    });
    expect(compute(facts).detail).toBe("Autumn Modern · Lot 12 · lot closed, sold on ATG");
  });

  it("says where a sale was made", () => {
    const soldAt = moved("sold", "bid_sale", "2026-11-14T21:00:00Z");
    expect(
      compute(factsFor("sold", lotRef, { lot: lotIn("ended", "ended"), ...soldAt })),
    ).toMatchObject({
      value: "Sold in LAX Bid",
      detail: "Autumn Modern · Lot 12 · sold 14 Nov 2026",
      link: PUBLIC_LOT,
    });
    expect(
      compute(factsFor("sold", shopRef, { laxArt: laxArtListing(), ...soldAt })),
    ).toMatchObject({ value: "Sold on lax.art", detail: "Sold 14 Nov 2026" });
    expect(compute(factsFor("sold", { kind: "private_sale", id: "d" }, { ...soldAt })).value).toBe(
      "Sold privately",
    );
    expect(
      compute(factsFor("sold", { kind: "gallery_sale", id: "z" }, { ...soldAt })),
    ).toMatchObject({
      value: "Sold in the gallery",
      detail: "Recorded from the Zoho Status 14 Nov 2026",
      link: RECORD,
    });
    expect(compute(factsFor("sold")).value).toBe("Sold");
  });

  it("reads Withdrawn with where from for 30 days, then Not offered", () => {
    const recent = moved("withdrawn", "bid_sale", "2026-11-01T09:00:00Z");
    expect(compute(factsFor("withdrawn", null, recent))).toMatchObject({
      value: "Withdrawn",
      detail: "Withdrawn from LAX Bid 1 Nov 2026",
    });
    const old = moved("withdrawn", "lax_art", "2026-09-01T09:00:00Z");
    expect(compute(factsFor("withdrawn", null, old)).value).toBe("Not offered");
  });

  it("never sends more than Zoho's text field holds", () => {
    const lot = lotIn("scheduled", "scheduled");
    const long = { ...lot, sale: lot.sale ? { ...lot.sale, title: "A".repeat(400) } : null };
    const { detail } = compute(factsFor("bid_sale", lotRef, { lot: long }));
    expect(detail?.length).toBe(255);
    expect(detail?.endsWith("…")).toBe(true);
  });
});
