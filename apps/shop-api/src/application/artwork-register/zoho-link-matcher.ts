import { parseStockCode } from "@auction/artwork-register-contracts";

/**
 * Matching lax.art originals to register records, as a pure function. It never links anything: it
 * only says which record, if any, each listing most likely is.
 *
 * Rules, in order:
 * 1. A listing that carries a stock code matches the record with that stock code, and nothing else.
 *    A code Zoho does not know is "no match"; the title is not tried instead.
 * 2. Otherwise the Zoho artist code and the title together. Several records with that artist and
 *    title are told apart by size, then by year.
 * 3. The title alone is never enough (a listing with no artist code is "no match").
 * A record wanted by more than one listing is never offered as a match to any of them.
 */

export type MatchListing = {
  artworkId: string;
  title: string;
  /** The Zoho artist code carried by the listing's lax.art artist; null when the artist has none. */
  artistCode: string | null;
  /** The stock code the listing carries, when it has one. */
  stockCode: string | null;
  dimensions: string | null;
  year: number | null;
};

export type MatchRecord = {
  registerId: string;
  stockCode: string;
  title: string;
  artistCode: string;
  dimensions: string | null;
  year: number | null;
};

export type MatchRule =
  | "stock_code"
  | "artist_and_title"
  | "artist_title_and_size"
  | "artist_title_and_year";

export type NoMatchReason =
  /** The listing carries a stock code that no record holds. */
  | "stock_code_unknown"
  /** The listing's artist has no Zoho artist code, and the title alone is never enough. */
  | "artist_has_no_zoho_code"
  /** No record has this artist and title. */
  | "no_record_for_artist_and_title";

export type ListingMatch =
  | { kind: "matched"; registerId: string; rule: MatchRule }
  | { kind: "choice"; registerIds: readonly string[] }
  | { kind: "none"; reason: NoMatchReason };

const WHITESPACE = /\s+/g;

/** A title as compared: no case, accents, punctuation or repeated spaces. */
export function normaliseTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(WHITESPACE, " ")
    .trim();
}

/** The numbers in a size, in order from smallest, so "90 × 120 cm" equals "120x90". Null for no size. */
export function normaliseSize(size: string | null): string | null {
  if (!size) return null;
  const numbers = (size.replace(/,/g, ".").match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (numbers.length === 0) return null;
  return numbers.sort((a, b) => a - b).join("x");
}

const upper = (value: string) => value.trim().toUpperCase();

function narrow<T>(candidates: readonly T[], keep: (candidate: T) => boolean): readonly T[] | null {
  const kept = candidates.filter(keep);
  return kept.length > 0 ? kept : null;
}

function matchOne(listing: MatchListing, records: readonly MatchRecord[]): ListingMatch {
  if (listing.stockCode && parseStockCode(upper(listing.stockCode))) {
    const code = upper(listing.stockCode);
    const record = records.find((candidate) => upper(candidate.stockCode) === code);
    return record
      ? { kind: "matched", registerId: record.registerId, rule: "stock_code" }
      : { kind: "none", reason: "stock_code_unknown" };
  }

  if (!listing.artistCode) return { kind: "none", reason: "artist_has_no_zoho_code" };
  const artist = upper(listing.artistCode);
  const title = normaliseTitle(listing.title);
  if (title === "") return { kind: "none", reason: "no_record_for_artist_and_title" };
  const sameWork = records.filter(
    (record) => upper(record.artistCode) === artist && normaliseTitle(record.title) === title,
  );
  if (sameWork.length === 0) return { kind: "none", reason: "no_record_for_artist_and_title" };
  const only = sameWork[0];
  if (sameWork.length === 1 && only) {
    return { kind: "matched", registerId: only.registerId, rule: "artist_and_title" };
  }

  // Several records share the artist and title: size, then year, tell them apart when they can.
  const size = normaliseSize(listing.dimensions);
  const bySize =
    size === null ? null : narrow(sameWork, (record) => normaliseSize(record.dimensions) === size);
  const bySizeOnly = bySize?.length === 1 ? bySize[0] : undefined;
  if (bySizeOnly) {
    return { kind: "matched", registerId: bySizeOnly.registerId, rule: "artist_title_and_size" };
  }
  const afterSize = bySize ?? sameWork;
  const byYear =
    listing.year === null ? null : narrow(afterSize, (record) => record.year === listing.year);
  const byYearOnly = byYear?.length === 1 ? byYear[0] : undefined;
  if (byYearOnly) {
    return { kind: "matched", registerId: byYearOnly.registerId, rule: "artist_title_and_year" };
  }
  const remaining = byYear ?? afterSize;
  return { kind: "choice", registerIds: remaining.map((record) => record.registerId) };
}

/**
 * The match for every listing. A record that two or more listings would each match is wanted by
 * all of them, so none gets it as a plain match: each is shown it as a choice for staff to settle.
 */
export function matchListings(
  listings: readonly MatchListing[],
  records: readonly MatchRecord[],
): Map<string, ListingMatch> {
  const results = new Map<string, ListingMatch>();
  const claims = new Map<string, string[]>();
  for (const listing of listings) {
    const result = matchOne(listing, records);
    results.set(listing.artworkId, result);
    if (result.kind === "matched") {
      claims.set(result.registerId, [...(claims.get(result.registerId) ?? []), listing.artworkId]);
    }
  }
  for (const [registerId, artworkIds] of claims) {
    if (artworkIds.length < 2) continue;
    for (const artworkId of artworkIds)
      results.set(artworkId, { kind: "choice", registerIds: [registerId] });
  }
  return results;
}
