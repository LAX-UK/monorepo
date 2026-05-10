/**
 * Shared classification for SE-P23 lot artist backfill (audit CSV + pass-2 / pass-3).
 * DB-heavy matching is done by callers; this module decides the bucket from inputs.
 */

export type LotArtistBackfillClassification =
  | "clean_artist_profile_id"
  | "clean_text_match"
  | "text_no_match"
  | "ambiguous_text"
  | "value_is_user_id"
  | "corrupt";

export type ArtistCandidate = { id: string; displayName: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Heuristic: legacy lots sometimes stored a Better Auth user id in `artist_id`. */
export function looksLikeAuthUserId(value: string): boolean {
  const v = value.trim();
  if (isUuid(v)) return false;
  return /^[a-z0-9_]{16,40}$/i.test(v);
}

export function hintFromLotTitle(title: string): string | null {
  const t = title.trim();
  if (!t) return null;
  const dashSplit = t.split(/\s+[—–-]\s+/);
  if (dashSplit.length >= 2 && dashSplit[0]) {
    return dashSplit[0].trim() || null;
  }
  return null;
}

export type ClassifyLotArtistBackfillInput = {
  /** Current `lot.artist_id` column (may be mis-set). */
  artistIdColumn: string | null;
  marketingSellerArtistId: string | null;
  /** Display hint (title prefix, marketing note, …). */
  hintText: string | null;
  /** Rows returned from DB for UUID resolution (`artist_id` column or legacy marketing JSON). */
  uuidLookupHits: ArtistCandidate[];
  /** Rows returned from fuzzy/exact name resolution on `hintText`. */
  textLookupHits: ArtistCandidate[];
};

export type ClassifyLotArtistBackfillResult = {
  classification: LotArtistBackfillClassification;
  suggestedArtistId?: string;
  suggestedArtistName?: string;
  ambiguityCount: number;
};

/** Deterministic classification for one lot row + precomputed lookup hits. */
export function classifyLotArtistBackfill(
  input: ClassifyLotArtistBackfillInput,
): ClassifyLotArtistBackfillResult {
  const col = input.artistIdColumn?.trim() ?? "";

  if (col && !isUuid(col)) {
    if (looksLikeAuthUserId(col)) {
      return {
        classification: "value_is_user_id",
        ambiguityCount: 0,
      };
    }
    return { classification: "corrupt", ambiguityCount: 0 };
  }

  const seller = input.marketingSellerArtistId?.trim() ?? "";
  const sellerOk = seller ? isUuid(seller) : false;
  if (seller && !sellerOk) {
    return { classification: "corrupt", ambiguityCount: 0 };
  }

  // Prefer explicit marketing UUID when column is empty.
  if (!col && sellerOk) {
    if (input.uuidLookupHits.length === 1 && input.uuidLookupHits[0]) {
      const h = input.uuidLookupHits[0];
      return {
        classification: "clean_artist_profile_id",
        suggestedArtistId: h.id,
        suggestedArtistName: h.displayName,
        ambiguityCount: 0,
      };
    }
    if (input.uuidLookupHits.length === 0) {
      return { classification: "corrupt", ambiguityCount: 0 };
    }
  }

  if (col && isUuid(col)) {
    if (input.uuidLookupHits.length === 1 && input.uuidLookupHits[0]) {
      const h = input.uuidLookupHits[0];
      return {
        classification: "clean_artist_profile_id",
        suggestedArtistId: h.id,
        suggestedArtistName: h.displayName,
        ambiguityCount: 0,
      };
    }
    if (input.uuidLookupHits.length === 0) {
      return { classification: "corrupt", ambiguityCount: 0 };
    }
  }

  const hint = input.hintText?.trim() ?? "";
  if (!hint) {
    return { classification: "text_no_match", ambiguityCount: 0 };
  }

  const n = input.textLookupHits.length;
  if (n === 1 && input.textLookupHits[0]) {
    const h = input.textLookupHits[0];
    return {
      classification: "clean_text_match",
      suggestedArtistId: h.id,
      suggestedArtistName: h.displayName,
      ambiguityCount: 1,
    };
  }
  if (n > 1) {
    return {
      classification: "ambiguous_text",
      ambiguityCount: n,
    };
  }

  return { classification: "text_no_match", ambiguityCount: 0 };
}
