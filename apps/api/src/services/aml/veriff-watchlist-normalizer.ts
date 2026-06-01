import type {
  VeriffWatchlistHit,
  VeriffWatchlistWebhookPayload,
} from "../../lib/veriff/veriff-watchlist-types.js";
import { mapProviderListToCategory } from "./aml-config.js";
import type {
  AmlScreeningHit,
  AmlScreeningMatchStatus,
  AmlScreeningMonitorStatus,
  AmlScreeningResult,
  AmlWatchlistCategory,
} from "./aml-types.js";

export type NormalizedWatchlistScreening = {
  userId: string | null;
  providerSessionId: string | null;
  result: AmlScreeningResult;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Reads a field from the top level or from a nested `data`/`searchResults` object. */
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
  if (normalized.includes("monitor") || normalized === "enabled" || normalized === "active") {
    return "monitored";
  }
  return "not_monitored";
}

function hitCategories(hit: VeriffWatchlistHit): AmlWatchlistCategory[] {
  const labels: string[] = [];
  if (Array.isArray(hit.datasets)) labels.push(...hit.datasets);
  if (hit.listType) labels.push(hit.listType);
  if (hit.listName) labels.push(hit.listName);
  const categories = labels.map(mapProviderListToCategory);
  return categories.length > 0 ? categories : ["other"];
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
    const categories = hitCategories(rawHit);
    for (const category of categories) categorySet.add(category);
    hits.push({
      category: categories[0] ?? "other",
      listName: rawHit.listName ?? null,
      matchedName: rawHit.matchedName ?? rawHit.name ?? null,
      score: typeof rawHit.score === "number" ? rawHit.score : null,
    });
  }

  return { hits, categories: [...categorySet] };
}

/** Normalizes a Veriff watchlist-screening webhook into the provider-agnostic result. */
export function normalizeVeriffWatchlistWebhook(
  payload: VeriffWatchlistWebhookPayload,
): NormalizedWatchlistScreening {
  const verification = asRecord(payload.verification);
  const data = asRecord(payload.data);
  const dataVerification = asRecord(data?.verification);
  const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

  const providerSessionId =
    payload.sessionId ?? str(verification?.id) ?? str(dataVerification?.id) ?? null;

  const userId =
    payload.vendorData ??
    str(verification?.vendorData) ??
    str(dataVerification?.vendorData) ??
    null;

  const matchStatus = normalizeMatchStatus(
    pick<string>(payload, (s) => (typeof s.matchStatus === "string" ? s.matchStatus : undefined)),
  );
  const monitorStatus = normalizeMonitorStatus(
    pick<string>(payload, (s) =>
      typeof s.monitoringStatus === "string" ? s.monitoringStatus : undefined,
    ),
  );
  const { hits, categories } = normalizeHits(payload);
  const totalHits =
    pick<number>(payload, (s) => (typeof s.totalHits === "number" ? s.totalHits : undefined)) ??
    hits.length;

  return {
    userId,
    providerSessionId,
    result: {
      provider: "veriff",
      providerSessionId: providerSessionId ?? "",
      matchStatus,
      monitorStatus,
      totalHits,
      hits,
      categories,
      rawPayload: payload as Record<string, unknown>,
      screenedAt: new Date(),
    },
  };
}
