import { str } from "@/lib/data/http/compliance.shared";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { z } from "zod";

export type AdminAmlScreeningHitRow = {
  matchedName: string | null;
  countries: string[];
  dateOfBirth: string | null;
  matchTypes: string[];
  categories: string[];
  listings: Partial<
    Record<
      string,
      Array<{
        sourceName: string;
        sourceUrl: string | null;
        snippet: string | null;
        date: string | null;
      }>
    >
  >;
};

export type AdminAmlScreeningRow = {
  id: string;
  userId: string;
  providerSessionId: string;
  matchStatus: string;
  monitorStatus: string;
  totalHits: number;
  categories: string[];
  hits: AdminAmlScreeningHitRow[];
  checkType: string | null;
  decisionOutcome: string;
  reviewStatus: string;
  triageRecommendation: string | null;
  triagedByUserId: string | null;
  triagedAt: string | null;
  triageNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  screenedAt: string;
  createdAt: string;
};

function parseListingEntry(raw: unknown): {
  sourceName: string;
  sourceUrl: string | null;
  snippet: string | null;
  date: string | null;
} {
  if (!isIndexableObject(raw)) {
    return { sourceName: "", sourceUrl: null, snippet: null, date: null };
  }
  return {
    sourceName: str(raw.sourceName),
    sourceUrl: raw.sourceUrl == null ? null : str(raw.sourceUrl),
    snippet: raw.snippet == null ? null : str(raw.snippet),
    date: raw.date == null ? null : str(raw.date),
  };
}

function parseHitListings(raw: unknown): AdminAmlScreeningHitRow["listings"] {
  if (!isIndexableObject(raw)) return {};
  const out: AdminAmlScreeningHitRow["listings"] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      out[key] = value.map(parseListingEntry);
    }
  }
  return out;
}

function parseHit(raw: unknown): AdminAmlScreeningHitRow {
  const h = isIndexableObject(raw) ? raw : {};
  return {
    matchedName: h.matchedName == null ? null : str(h.matchedName),
    countries: Array.isArray(h.countries) ? h.countries.map(String) : [],
    dateOfBirth: h.dateOfBirth == null ? null : str(h.dateOfBirth),
    matchTypes: Array.isArray(h.matchTypes) ? h.matchTypes.map(String) : [],
    categories: Array.isArray(h.categories) ? h.categories.map(String) : [],
    listings: parseHitListings(h.listings),
  };
}

const screeningRowSchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): AdminAmlScreeningRow | null => {
    if (!isIndexableObject(raw)) return null;
    const id = str(raw.id);
    const userId = str(raw.userId);
    if (!id || !userId) return null;
    const categories = Array.isArray(raw.categories)
      ? raw.categories.map((c) => String(c))
      : typeof raw.categories === "string"
        ? raw.categories
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : [];
    const hits = Array.isArray(raw.hits) ? raw.hits.map(parseHit) : [];
    return {
      id,
      userId,
      providerSessionId: str(raw.providerSessionId),
      matchStatus: str(raw.matchStatus),
      monitorStatus: str(raw.monitorStatus),
      totalHits: Number(raw.totalHits ?? 0),
      categories,
      hits,
      checkType: raw.checkType == null ? null : str(raw.checkType),
      decisionOutcome: str(raw.decisionOutcome),
      reviewStatus: str(raw.reviewStatus),
      triageRecommendation: raw.triageRecommendation == null ? null : str(raw.triageRecommendation),
      triagedByUserId: raw.triagedByUserId == null ? null : str(raw.triagedByUserId),
      triagedAt: raw.triagedAt == null ? null : String(raw.triagedAt),
      triageNotes: raw.triageNotes == null ? null : str(raw.triageNotes),
      reviewedByUserId: raw.reviewedByUserId == null ? null : str(raw.reviewedByUserId),
      reviewedAt: raw.reviewedAt == null ? null : String(raw.reviewedAt),
      reviewNotes: raw.reviewNotes == null ? null : str(raw.reviewNotes),
      screenedAt: String(raw.screenedAt ?? ""),
      createdAt: String(raw.createdAt ?? ""),
    };
  });

export const adminAmlScreeningRowSchema =
  screeningRowSchema as z.ZodType<AdminAmlScreeningRow | null>;

export function screeningFromJson(raw: unknown): AdminAmlScreeningRow | null {
  return screeningRowSchema.parse(raw);
}

type _ScreeningRowInfer = z.infer<typeof screeningRowSchema>;
const _screeningRowTypeGuard =
  null as unknown as _ScreeningRowInfer satisfies AdminAmlScreeningRow | null;
void _screeningRowTypeGuard;
