import { describe, expect, it } from "vitest";
import {
  type MatchListing,
  type MatchRecord,
  matchListings,
  normaliseSize,
  normaliseTitle,
} from "./zoho-link-matcher.js";

const listing = (patch: Partial<MatchListing> = {}): MatchListing => ({
  artworkId: "a1",
  title: "Tidal margin IV",
  artistCode: "AR",
  stockCode: null,
  dimensions: null,
  year: null,
  ...patch,
});

let n = 0;
const record = (patch: Partial<MatchRecord> = {}): MatchRecord => {
  n += 1;
  return {
    registerId: `r${n}`,
    stockCode: `LAX-ORI-AR-TM-26-${String(n).padStart(4, "0")}`,
    title: "Tidal margin IV",
    artistCode: "AR",
    dimensions: null,
    year: null,
    ...patch,
  };
};

const matchOf = (l: MatchListing, records: MatchRecord[]) =>
  matchListings([l], records).get(l.artworkId);

describe("normalising", () => {
  it("compares titles without case, accents, punctuation or spacing", () => {
    expect(normaliseTitle("  Tidal   Margin, IV! ")).toBe("tidal margin iv");
    expect(normaliseTitle("Café & Lumière")).toBe("cafe and lumiere");
  });

  it("compares sizes by their numbers, whichever way round and unit", () => {
    expect(normaliseSize("90 × 120 cm")).toBe(normaliseSize("120x90"));
    expect(normaliseSize("12,5 x 20")).toBe("12.5x20");
    expect(normaliseSize("")).toBeNull();
    expect(normaliseSize("large")).toBeNull();
  });
});

describe("rule 1: the stock code", () => {
  it("matches the record that holds the code, whatever the title says", () => {
    const target = record({ title: "Completely different", artistCode: "ZZ" });
    const decoy = record();
    expect(matchOf(listing({ stockCode: target.stockCode }), [decoy, target])).toEqual({
      kind: "matched",
      registerId: target.registerId,
      rule: "stock_code",
    });
  });

  it("ignores the case and spacing of the code", () => {
    const target = record();
    expect(
      matchOf(listing({ stockCode: ` ${target.stockCode.toLowerCase()} ` }), [target]),
    ).toMatchObject({ kind: "matched", registerId: target.registerId });
  });

  it("is no match when Zoho does not know the code, and does not fall back to the title", () => {
    const sameTitle = record();
    expect(matchOf(listing({ stockCode: "LAX-ORI-AR-TM-26-9999" }), [sameTitle])).toEqual({
      kind: "none",
      reason: "stock_code_unknown",
    });
  });

  it("falls to the artist and title when the listing's code is not a LAX stock code", () => {
    const target = record();
    expect(matchOf(listing({ stockCode: "old-sku-17" }), [target])).toMatchObject({
      kind: "matched",
      rule: "artist_and_title",
    });
  });
});

describe("rule 2: artist code and title", () => {
  it("matches the one record with that artist and title", () => {
    const target = record({ title: "TIDAL MARGIN, IV" });
    expect(matchOf(listing(), [target, record({ title: "Other work" })])).toEqual({
      kind: "matched",
      registerId: target.registerId,
      rule: "artist_and_title",
    });
  });

  it("does not match another artist's work of the same title", () => {
    expect(matchOf(listing(), [record({ artistCode: "BB" })])).toEqual({
      kind: "none",
      reason: "no_record_for_artist_and_title",
    });
  });

  it("tells records apart by size", () => {
    const small = record({ dimensions: "30 × 40 cm" });
    const big = record({ dimensions: "90 × 120 cm" });
    expect(matchOf(listing({ dimensions: "120 x 90" }), [small, big])).toEqual({
      kind: "matched",
      registerId: big.registerId,
      rule: "artist_title_and_size",
    });
  });

  it("falls back to the year when size does not decide", () => {
    const a = record({ dimensions: "90 × 120 cm", year: 2022 });
    const b = record({ dimensions: "90 × 120 cm", year: 2024 });
    expect(matchOf(listing({ dimensions: "90 × 120 cm", year: 2024 }), [a, b])).toEqual({
      kind: "matched",
      registerId: b.registerId,
      rule: "artist_title_and_year",
    });
  });

  it("uses the year when the listing has no size", () => {
    const a = record({ year: 2022 });
    const b = record({ year: 2024 });
    expect(matchOf(listing({ year: 2022 }), [a, b])).toMatchObject({
      kind: "matched",
      registerId: a.registerId,
    });
  });

  it("asks for a choice when size and year cannot decide, naming only the records still in play", () => {
    const a = record({ dimensions: "90 × 120 cm", year: 2024 });
    const b = record({ dimensions: "90 × 120 cm", year: 2024 });
    const other = record({ dimensions: "10 × 10 cm", year: 2024 });
    expect(matchOf(listing({ dimensions: "90 × 120 cm", year: 2024 }), [a, b, other])).toEqual({
      kind: "choice",
      registerIds: [a.registerId, b.registerId],
    });
  });

  it("asks for a choice, with every candidate, when the listing has no size or year to go by", () => {
    const a = record();
    const b = record();
    expect(matchOf(listing(), [a, b])).toEqual({
      kind: "choice",
      registerIds: [a.registerId, b.registerId],
    });
  });

  it("keeps every candidate when the listing's size matches none of them", () => {
    const a = record({ dimensions: "30 × 40 cm" });
    const b = record({ dimensions: "50 × 60 cm" });
    expect(matchOf(listing({ dimensions: "90 × 120 cm" }), [a, b])).toMatchObject({
      kind: "choice",
      registerIds: [a.registerId, b.registerId],
    });
  });
});

describe("rule 3: never the title alone", () => {
  it("is no match for a listing whose artist has no Zoho code, even with one exact title", () => {
    expect(matchOf(listing({ artistCode: null }), [record()])).toEqual({
      kind: "none",
      reason: "artist_has_no_zoho_code",
    });
  });

  it("is no match for a blank title", () => {
    expect(matchOf(listing({ title: " – " }), [record({ title: "!" })])).toMatchObject({
      kind: "none",
    });
  });
});

describe("a record wanted twice", () => {
  it("is a choice for both listings and a match for neither", () => {
    const shared = record();
    const results = matchListings(
      [listing({ artworkId: "a1" }), listing({ artworkId: "a2" })],
      [shared],
    );
    for (const id of ["a1", "a2"]) {
      expect(results.get(id)).toEqual({ kind: "choice", registerIds: [shared.registerId] });
    }
  });

  it("leaves other listings alone", () => {
    const shared = record();
    const solo = record({ title: "Solo", stockCode: "LAX-ORI-AR-SO-26-0001" });
    const results = matchListings(
      [
        listing({ artworkId: "a1" }),
        listing({ artworkId: "a2" }),
        listing({ artworkId: "a3", title: "Solo" }),
      ],
      [shared, solo],
    );
    expect(results.get("a3")).toMatchObject({ kind: "matched", registerId: solo.registerId });
  });
});

describe("matching is pure", () => {
  it("gives the same answer when run again and does not change its inputs", () => {
    const records = [record(), record({ title: "Other" })];
    const listings = [listing(), listing({ artworkId: "a2", title: "Nothing like it" })];
    const before = JSON.stringify({ records, listings });
    expect([...matchListings(listings, records)]).toEqual([...matchListings(listings, records)]);
    expect(JSON.stringify({ records, listings })).toBe(before);
  });
});
