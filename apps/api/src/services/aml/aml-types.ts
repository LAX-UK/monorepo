/**
 * AML bounded context — provider-agnostic domain types.
 *
 * These types are deliberately independent of Veriff so the screening provider
 * can be swapped (Open/Closed + Dependency Inversion). Adapters translate
 * provider payloads into these shapes at the boundary.
 */

/** Overall match disposition reported by the screening provider. */
export type AmlScreeningMatchStatus =
  | "no_match"
  | "possible_match"
  | "confirmed_match"
  | "false_positive";

/** Ongoing-monitoring lifecycle state for a screened subject. */
export type AmlScreeningMonitorStatus = "not_monitored" | "monitored" | "monitoring_paused";

/**
 * Watchlist categories the platform screens against (London Auction Xchange
 * CDD Section 5 set): sanctions, PEPs and adverse media, plus regulator
 * warning / fitness-and-probity lists.
 */
export type AmlWatchlistCategory =
  | "sanction"
  | "pep"
  | "adverse_media"
  | "warning"
  | "fitness_probity"
  | "other";

/** A matched listing entry (sanctions / PEP / adverse media source). */
export type AmlScreeningListing = {
  sourceName: string;
  sourceUrl: string | null;
  snippet: string | null;
  date: string | null;
};

/** A single matched record returned by the provider. */
export type AmlScreeningHit = {
  matchedName: string | null;
  countries: string[];
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  matchTypes: string[];
  aka: string[];
  associates: string[];
  /** Distinct watchlist categories present on this hit. */
  categories: AmlWatchlistCategory[];
  /** Grouped source listings by category (for MLRO adjudication). */
  listings: Partial<Record<AmlWatchlistCategory, AmlScreeningListing[]>>;
  /** Primary category (first detected) — kept for legacy callers. */
  category: AmlWatchlistCategory;
  listName: string | null;
  /** Provider match confidence in [0,1] when available (legacy payloads). */
  score: number | null;
};

/** Normalized screening result (provider-independent). */
export type AmlScreeningResult = {
  provider: string;
  providerSessionId: string;
  matchStatus: AmlScreeningMatchStatus;
  monitorStatus: AmlScreeningMonitorStatus;
  totalHits: number;
  hits: AmlScreeningHit[];
  /** Distinct categories present across all hits. */
  categories: AmlWatchlistCategory[];
  rawPayload: Record<string, unknown>;
  screenedAt: Date;
};

/** Decision outcomes from the pure AML policy. */
export type AmlDecisionOutcome = "clear" | "review" | "block";

export type AmlDecision = {
  outcome: AmlDecisionOutcome;
  /** Machine-readable reason codes explaining the outcome. */
  reasons: string[];
};

/** Persisted human review disposition for a flagged screening. */
export type AmlReviewStatus = "not_required" | "pending" | "cleared" | "blocked";

/**
 * First-line analyst recommendation in the two-stage maker-checker flow. The
 * MLRO (checker) makes the binding clear/block decision; this is only advisory.
 */
export type AmlTriageRecommendation = "recommend_clear" | "recommend_block";

/** Reasons a user may be placed on AML hold (blocks money-path progression). */
export type AmlHoldReason =
  | "sanctions_match"
  | "pep_match"
  | "adverse_media_match"
  | "screening_review";

export type AmlHoldStatus = "none" | "hold" | "blocked";
