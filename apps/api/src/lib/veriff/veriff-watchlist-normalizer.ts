import type {
  AmlScreeningHit,
  AmlScreeningListing,
  AmlScreeningMatchStatus,
  AmlScreeningMonitorStatus,
  AmlScreeningResult,
  AmlWatchlistCategory,
} from "../../services/aml/aml-types.js";
import { mapProviderListToCategory } from "./veriff-watchlist-categories.js";
import type {
  VeriffListingsRelatedToMatch,
  VeriffWatchlistHit,
  VeriffWatchlistListing,
  VeriffWatchlistWebhookPayload,
} from "./veriff-watchlist-types.js";

export type NormalizedWatchlistScreening = {
  userId: string | null;
  providerSessionId: string | null;
  checkType: "initial_result" | "updated_result" | null;
  result: AmlScreeningResult;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Reads a field from top level, nested `data`, or legacy `data.searchResults`. */
function pick<T>(
  payload: VeriffWatchlistWebhookPayload,
  read: (source: Record<string, unknown>) => T | undefined | null,
): T | null {
  const top = read(payload as unknown as Record<string, unknown>);
  if (top != null) return top;
  const data = asRecord(payload.data);
  if (data) {
    const fromData = read(data);
    if (fromData != null) return fromData;
    const searchResults = asRecord(data.searchResults);
    if (searchResults) {
      const fromSearch = read(searchResults);
      if (fromSearch != null) return fromSearch;
    }
  }
  return null;
}

function parseTotalHits(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function parseScreenedAt(payload: VeriffWatchlistWebhookPayload): Date {
  const raw = pick<string>(payload, (s) =>
    typeof s.createdAt === "string" ? s.createdAt : undefined,
  );
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function normalizeMatchStatus(raw: string | null): AmlScreeningMatchStatus {
  const normalized = (raw ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[\s-]+/g, "_");
  switch (normalized) {
    case "no_match":
    case "clear":
    case "no_hit":
      return "no_match";
    case "possible_match":
    case "potential_match":
    case "hit":
      return "possible_match";
    case "confirmed_match":
    case "true_match":
    case "true_positive":
    case "match":
      return "confirmed_match";
    case "false_positive":
    case "dismissed":
      return "false_positive";
    default:
      return raw ? "possible_match" : "no_match";
  }
}

function normalizeMonitorStatus(raw: string | null): AmlScreeningMonitorStatus {
  const normalized = (raw ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[\s-]+/g, "_");
  if (normalized.includes("paused")) return "monitoring_paused";
  if (
    normalized.includes("monitor") ||
    normalized === "enabled" ||
    normalized === "active" ||
    normalized === "monitored"
  ) {
    return "monitored";
  }
  if (normalized === "disabled" || normalized === "not_monitored") {
    return "not_monitored";
  }
  return "not_monitored";
}

function listingFromRaw(raw: VeriffWatchlistListing): AmlScreeningListing {
  return {
    sourceName: raw.sourceName ?? "Unknown source",
    sourceUrl: raw.sourceUrl ?? null,
    snippet: raw.snippet ?? null,
    date: raw.date ?? null,
  };
}

function categoriesFromListings(
  listings: VeriffListingsRelatedToMatch | null | undefined,
): AmlWatchlistCategory[] {
  if (!listings) return [];
  const out: AmlWatchlistCategory[] = [];
  if (Array.isArray(listings.sanctions) && listings.sanctions.length > 0) out.push("sanction");
  if (Array.isArray(listings.pep) && listings.pep.length > 0) out.push("pep");
  if (Array.isArray(listings.adverseMedia) && listings.adverseMedia.length > 0) {
    out.push("adverse_media");
  }
  if (Array.isArray(listings.warnings) && listings.warnings.length > 0) out.push("warning");
  if (Array.isArray(listings.fitnessProbity) && listings.fitnessProbity.length > 0) {
    out.push("fitness_probity");
  }
  return out;
}

function legacyHitCategories(hit: VeriffWatchlistHit): AmlWatchlistCategory[] {
  const labels: string[] = [];
  if (Array.isArray(hit.datasets)) labels.push(...hit.datasets);
  if (hit.listType) labels.push(hit.listType);
  if (hit.listName) labels.push(hit.listName);
  const categories = labels.map(mapProviderListToCategory);
  return categories.length > 0 ? categories : [];
}

function categoriesFromSearchLists(payload: VeriffWatchlistWebhookPayload): AmlWatchlistCategory[] {
  const lists =
    pick<string[]>(payload, (s) => (Array.isArray(s.lists) ? (s.lists as string[]) : undefined)) ??
    pick<string[]>(payload, (s) => {
      const searchTerm = asRecord(s.searchTerm);
      return Array.isArray(searchTerm?.lists) ? (searchTerm.lists as string[]) : undefined;
    });
  if (!lists) return [];
  return [...new Set(lists.map(mapProviderListToCategory))];
}

function buildHitListings(
  listings: VeriffListingsRelatedToMatch | null | undefined,
): Partial<Record<AmlWatchlistCategory, AmlScreeningListing[]>> {
  if (!listings) return {};
  const out: Partial<Record<AmlWatchlistCategory, AmlScreeningListing[]>> = {};
  if (Array.isArray(listings.sanctions) && listings.sanctions.length > 0) {
    out.sanction = listings.sanctions.map(listingFromRaw);
  }
  if (Array.isArray(listings.pep) && listings.pep.length > 0) {
    out.pep = listings.pep.map(listingFromRaw);
  }
  if (Array.isArray(listings.adverseMedia) && listings.adverseMedia.length > 0) {
    out.adverse_media = listings.adverseMedia.map(listingFromRaw);
  }
  if (Array.isArray(listings.warnings) && listings.warnings.length > 0) {
    out.warning = listings.warnings.map(listingFromRaw);
  }
  if (Array.isArray(listings.fitnessProbity) && listings.fitnessProbity.length > 0) {
    out.fitness_probity = listings.fitnessProbity.map(listingFromRaw);
  }
  return out;
}

function firstListName(
  listings: Partial<Record<AmlWatchlistCategory, AmlScreeningListing[]>>,
): string | null {
  for (const group of Object.values(listings)) {
    const first = group?.[0];
    if (first?.sourceName) return first.sourceName;
  }
  return null;
}

function normalizeHit(rawHit: VeriffWatchlistHit): {
  hit: AmlScreeningHit;
  categories: AmlWatchlistCategory[];
} {
  const listingCategories = categoriesFromListings(rawHit.listingsRelatedToMatch);
  const legacyCategories = legacyHitCategories(rawHit);
  const categories =
    listingCategories.length > 0
      ? listingCategories
      : legacyCategories.length > 0
        ? legacyCategories
        : (["other"] as AmlWatchlistCategory[]);
  const hitListings = buildHitListings(rawHit.listingsRelatedToMatch);

  return {
    categories,
    hit: {
      matchedName: rawHit.matchedName ?? rawHit.name ?? null,
      countries: Array.isArray(rawHit.countries) ? rawHit.countries : [],
      dateOfBirth: rawHit.dateOfBirth ?? null,
      dateOfDeath: rawHit.dateOfDeath ?? null,
      matchTypes: Array.isArray(rawHit.matchTypes) ? rawHit.matchTypes : [],
      aka: Array.isArray(rawHit.aka) ? rawHit.aka : [],
      associates: Array.isArray(rawHit.associates) ? rawHit.associates : [],
      categories,
      listings: hitListings,
      category: categories[0] ?? "other",
      listName: rawHit.listName ?? firstListName(hitListings),
      score: typeof rawHit.score === "number" ? rawHit.score : null,
    },
  };
}

function normalizeHits(payload: VeriffWatchlistWebhookPayload): {
  hits: AmlScreeningHit[];
  categories: AmlWatchlistCategory[];
} {
  const rawHits =
    pick<VeriffWatchlistHit[]>(payload, (s) =>
      Array.isArray(s.hits) ? (s.hits as VeriffWatchlistHit[]) : undefined,
    ) ?? [];

  const hits: AmlScreeningHit[] = [];
  const categorySet = new Set<AmlWatchlistCategory>();

  for (const rawHit of rawHits) {
    const normalized = normalizeHit(rawHit);
    for (const category of normalized.categories) categorySet.add(category);
    hits.push(normalized.hit);
  }

  for (const category of categoriesFromSearchLists(payload)) {
    categorySet.add(category);
  }

  return { hits, categories: [...categorySet] };
}

function resolveCheckType(
  payload: VeriffWatchlistWebhookPayload,
): "initial_result" | "updated_result" | null {
  const raw = pick<string>(payload, (s) =>
    s.checkType === "initial_result" || s.checkType === "updated_result" ? s.checkType : undefined,
  );
  return raw === "initial_result" || raw === "updated_result" ? raw : null;
}

/** Normalizes a Veriff watchlist-screening webhook into the provider-agnostic result. */
export function normalizeVeriffWatchlistWebhook(
  payload: VeriffWatchlistWebhookPayload,
): NormalizedWatchlistScreening {
  const data = asRecord(payload.data);
  const verification = asRecord(payload.verification);
  const dataVerification = asRecord(data?.verification);

  const providerSessionId =
    pick<string>(payload, (s) => (typeof s.sessionId === "string" ? s.sessionId : undefined)) ??
    str(verification?.id) ??
    str(dataVerification?.id) ??
    null;

  const userId =
    pick<string>(payload, (s) => (typeof s.vendorData === "string" ? s.vendorData : undefined)) ??
    str(verification?.vendorData) ??
    str(dataVerification?.vendorData) ??
    null;

  const matchStatus = normalizeMatchStatus(
    pick<string>(payload, (s) => (typeof s.matchStatus === "string" ? s.matchStatus : undefined)),
  );
  const monitorStatus = normalizeMonitorStatus(
    pick<string>(payload, (s) => {
      if (typeof s.monitorStatus === "string") return s.monitorStatus;
      if (typeof s.monitoringStatus === "string") return s.monitoringStatus;
      return undefined;
    }),
  );
  const { hits, categories } = normalizeHits(payload);
  const totalHits = parseTotalHits(
    pick<number | string>(payload, (s) =>
      typeof s.totalHits === "number" || typeof s.totalHits === "string" ? s.totalHits : undefined,
    ),
    hits.length,
  );

  return {
    userId,
    providerSessionId,
    checkType: resolveCheckType(payload),
    result: {
      provider: "veriff",
      providerSessionId: providerSessionId ?? "",
      matchStatus,
      monitorStatus,
      totalHits,
      hits,
      categories,
      rawPayload: payload as Record<string, unknown>,
      screenedAt: parseScreenedAt(payload),
    },
  };
}
