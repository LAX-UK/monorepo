import type { Database } from "@auction/db";
import { artistProfile, lot } from "@auction/db/schema";
import type { LotMarketingDetails } from "@auction/types";
import { and, eq, ilike, inArray, ne } from "drizzle-orm";
import {
  type ArtistCandidate,
  type ClassifyLotArtistBackfillResult,
  classifyLotArtistBackfill,
  hintFromLotTitle,
  isUuid,
} from "./classifier.js";

export type LotArtistBackfillRow = {
  lotId: string;
  currentArtistId: string | null;
  title: string;
  marketingSellerArtistId: string | null;
  hintText: string | null;
  classification: ClassifyLotArtistBackfillResult["classification"];
  suggestedArtistId: string | undefined;
  suggestedArtistName: string | undefined;
  ambiguityCount: number;
};

function sellerArtistFromMarketing(details: Record<string, unknown>): string | null {
  const md = details as LotMarketingDetails;
  const v = md.sellerArtistId;
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v === null) return null;
  return null;
}

function artistNoteHint(details: Record<string, unknown>): string | null {
  const md = details as LotMarketingDetails;
  const n = md.artistNote?.trim();
  return n || null;
}

export async function analyzeLotArtistBackfill(db: Database, lotRow: {
  id: string;
  artistId: string | null;
  title: string;
  marketingDetails: Record<string, unknown>;
}): Promise<LotArtistBackfillRow> {
  const seller = sellerArtistFromMarketing(lotRow.marketingDetails);
  const noteHint = artistNoteHint(lotRow.marketingDetails);
  const titleHint = hintFromLotTitle(lotRow.title);
  const hintText = noteHint ?? titleHint;

  const uuidCandidates: ArtistCandidate[] = [];
  const idToResolve = lotRow.artistId?.trim() || seller || "";
  if (idToResolve && isUuid(idToResolve)) {
    const rows = await db
      .select({ id: artistProfile.id, displayName: artistProfile.displayName })
      .from(artistProfile)
      .where(eq(artistProfile.id, idToResolve))
      .limit(2);
    for (const r of rows) {
      uuidCandidates.push({ id: r.id as string, displayName: r.displayName as string });
    }
  }

  let textCandidates: ArtistCandidate[] = [];
  if (hintText && hintText.length >= 2) {
    const pattern = `%${hintText.trim()}%`;
    textCandidates = await db
      .select({ id: artistProfile.id, displayName: artistProfile.displayName })
      .from(artistProfile)
      .where(
        and(ne(artistProfile.status, "merged_into"), ilike(artistProfile.displayName, pattern)),
      )
      .limit(15);
  }

  const result = classifyLotArtistBackfill({
    artistIdColumn: lotRow.artistId,
    marketingSellerArtistId: seller,
    hintText,
    uuidLookupHits: uuidCandidates,
    textLookupHits: textCandidates,
  });

  const row: LotArtistBackfillRow = {
    lotId: lotRow.id,
    currentArtistId: lotRow.artistId,
    title: lotRow.title,
    marketingSellerArtistId: seller,
    hintText,
    classification: result.classification,
    suggestedArtistId: undefined,
    suggestedArtistName: undefined,
    ambiguityCount: result.ambiguityCount,
  };
  if (result.suggestedArtistId !== undefined) row.suggestedArtistId = result.suggestedArtistId;
  if (result.suggestedArtistName !== undefined) row.suggestedArtistName = result.suggestedArtistName;
  return row;
}

export async function loadAllLotsForBackfill(db: Database): Promise<
  {
    id: string;
    artistId: string | null;
    title: string;
    marketingDetails: Record<string, unknown>;
  }[]
> {
  const rows = await db
    .select({
      id: lot.id,
      artistId: lot.artistId,
      title: lot.title,
      marketingDetails: lot.marketingDetails,
    })
    .from(lot);
  return rows.map((r) => ({
    id: r.id as string,
    artistId: (r.artistId as string | null) ?? null,
    title: r.title as string,
    marketingDetails: (r.marketingDetails as Record<string, unknown>) ?? {},
  }));
}

/** Batch-fetch artist statuses for setting `artist_review_required` (DSE25). */
export async function fetchArtistStatuses(
  db: Database,
  ids: string[],
): Promise<Map<string, "pending" | "approved" | "rejected" | "merged_into">> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, "pending" | "approved" | "rejected" | "merged_into">();
  if (uniq.length === 0) return out;
  const rows = await db
    .select({ id: artistProfile.id, status: artistProfile.status })
    .from(artistProfile)
    .where(inArray(artistProfile.id, uniq));
  for (const r of rows) {
    out.set(r.id as string, r.status as "pending" | "approved" | "rejected" | "merged_into");
  }
  return out;
}

export function artistReviewRequiredForStatus(
  status: "pending" | "approved" | "rejected" | "merged_into" | undefined,
): boolean {
  return status !== "approved";
}
