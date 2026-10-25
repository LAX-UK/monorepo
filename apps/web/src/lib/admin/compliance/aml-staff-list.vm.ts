import { buildListHref } from "@/lib/admin/admin-list-params";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminAmlListSummary } from "@/lib/data/http/compliance-aml.shared";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import {
  amlWatchlistCategoryLabel,
  formatAmlCategoriesLabel,
} from "@/lib/presenters/status/compliance";
import type {
  AttentionStripItem,
  Metric,
  StatusPresentation,
  TimelineEvent,
} from "@auction/staff-ui";

export const AML_STAFF_LIST_PATH = "/admin/compliance/aml";

export type AmlListSearch = Record<string, string | string[] | undefined>;

export type AmlRecommendation = "clear" | "block";

/** One watchlist hit as the record panel shows it. */
export type AmlHitView = {
  name: string;
  /** "Match types: name, alias", "Countries: GB" and "Date of birth: …"; empty ones left out. */
  facts: string[];
  listings: Array<{
    category: string;
    items: Array<{ source: string; date: string | null; snippet: string | null }>;
  }>;
};

/** One screening as the staff list shows it; plain data, so it crosses to the client as is. */
export type AmlStaffRow = {
  id: string;
  userId: string;
  /** "Ada Lovelace", or "Client 1a2b3c4d" when the name is not known. */
  client: string;
  match: StatusPresentation;
  decision: StatusPresentation;
  monitor: StatusPresentation;
  /** "Sanctions, PEP"; null when the screening names no category. */
  categories: string | null;
  totalHits: number;
  screenedAt: string;
  checkType: string | null;
  providerSessionId: string;
  triage: {
    /** "Awaiting triage", "Recommended clear" or "Recommended block". */
    label: string;
    recommendation: AmlRecommendation | null;
    byUserId: string | null;
    at: string | null;
    notes: string | null;
  };
  review: { at: string | null; byUserId: string | null; notes: string | null } | null;
  hits: AmlHitView[];
};

/** "Client 1a2b3c4d": how a screening names its client until a name is known. */
export function amlClientFallbackLabel(userId: string): string {
  return `Client ${userId.slice(0, 8)}`;
}

function recommendationOf(value: string | null): AmlRecommendation | null {
  if (!value) return null;
  const token = value.startsWith("recommend_") ? value.slice("recommend_".length) : value;
  return token === "clear" || token === "block" ? token : null;
}

export function amlTriageLabel(recommendation: AmlRecommendation | null): string {
  if (recommendation === "clear") return "Recommended clear";
  if (recommendation === "block") return "Recommended block";
  return "Awaiting triage";
}

function toHitView(hit: AdminAmlScreeningRow["hits"][number]): AmlHitView {
  const facts = [
    hit.matchTypes.length > 0 ? `Match types: ${hit.matchTypes.join(", ")}` : null,
    hit.countries.length > 0 ? `Countries: ${hit.countries.join(", ")}` : null,
    hit.dateOfBirth ? `Date of birth: ${hit.dateOfBirth}` : null,
  ].filter((fact): fact is string => fact !== null);
  const listings = Object.entries(hit.listings)
    .filter(([, items]) => items && items.length > 0)
    .map(([category, items]) => ({
      category: amlWatchlistCategoryLabel[category] ?? category.replaceAll("_", " "),
      items: (items ?? []).map((item) => ({
        source: item.sourceName,
        date: item.date,
        snippet: item.snippet,
      })),
    }));
  return { name: hit.matchedName ?? "Unknown matched name", facts, listings };
}

export function toAmlStaffRow(
  row: AdminAmlScreeningRow,
  clientLabels: ReadonlyMap<string, string | null> = new Map(),
): AmlStaffRow {
  const recommendation = recommendationOf(row.triageRecommendation);
  return {
    id: row.id,
    userId: row.userId,
    client: clientLabels.get(row.userId)?.trim() || amlClientFallbackLabel(row.userId),
    match: staffStatus("amlMatch", row.matchStatus),
    decision: staffStatus("amlDecision", row.decisionOutcome),
    monitor: staffStatus("amlMonitor", row.monitorStatus),
    categories: row.categories.length > 0 ? formatAmlCategoriesLabel(row.categories) : null,
    totalHits: row.totalHits,
    screenedAt: row.screenedAt,
    checkType: row.checkType,
    providerSessionId: row.providerSessionId,
    triage: {
      label: amlTriageLabel(recommendation),
      recommendation,
      byUserId: row.triagedByUserId,
      at: row.triagedAt,
      notes: row.triageNotes?.trim() || null,
    },
    review: row.reviewedAt
      ? {
          at: row.reviewedAt,
          byUserId: row.reviewedByUserId,
          notes: row.reviewNotes?.trim() || null,
        }
      : null,
    hits: row.hits.map(toHitView),
  };
}

export function toAmlStaffRows(
  rows: readonly AdminAmlScreeningRow[],
  clientLabels?: ReadonlyMap<string, string | null>,
): AmlStaffRow[] {
  return rows.map((row) => toAmlStaffRow(row, clientLabels));
}

export type AmlCapabilities = {
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

/**
 * Where a screening stands in the two-stage maker-checker, for the person looking: whether they
 * can record the analyst triage, and whether they can make the binding MLRO decision (a
 * different person from the analyst who triaged).
 */
export type AmlStageAccess = {
  triage: "available" | "done" | "no-permission";
  decide: "available" | "no-permission" | "needs-triage" | "same-person";
};

export function amlStageAccess(row: AmlStaffRow, caps: AmlCapabilities): AmlStageAccess {
  const triaged = row.triage.recommendation !== null;
  const triage = !caps.canTriage ? "no-permission" : triaged ? "done" : "available";
  const samePerson =
    row.triage.byUserId !== null &&
    row.triage.byUserId.length > 0 &&
    row.triage.byUserId === caps.currentUserId;
  const decide = !caps.canDecide
    ? "no-permission"
    : !triaged
      ? "needs-triage"
      : samePerson
        ? "same-person"
        : "available";
  return { triage, decide };
}

/** Why the analyst triage is not on offer, in a sentence. */
export const AML_TRIAGE_REASONS = {
  "no-permission": "You do not have permission to record a first-line triage.",
  done: "Triage is recorded. A different MLRO must make the binding decision.",
} as const;

/** Why the binding decision is not on offer, in a sentence. */
export const AML_DECIDE_REASONS = {
  "no-permission": "Binding decisions need the MLRO role.",
  "needs-triage": "An analyst must record a triage before the MLRO can decide.",
  "same-person":
    "You recorded the triage for this screening. A different MLRO must make the binding decision.",
} as const;

/** A link to the list with some of its URL state changed; paging restarts. */
export function amlListHref(
  search: AmlListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: AmlListSearch = { ...search };
  for (const key of ["error", "success"]) delete base[key];
  return buildListHref(AML_STAFF_LIST_PATH, base, {
    ...("offset" in patch ? {} : { offset: null }),
    ...patch,
  });
}

/** The screening panel's activity, newest first. */
export function amlTimeline(row: AmlStaffRow): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: "screened",
      title: `Screened with ${row.totalHits} watchlist ${row.totalHits === 1 ? "hit" : "hits"}`,
      at: row.screenedAt,
      tone: row.totalHits > 0 ? "warning" : "neutral",
    },
  ];
  if (row.triage.recommendation && row.triage.at) {
    events.push({
      id: "triage",
      title: `Analyst triage: ${row.triage.label.toLowerCase()}`,
      at: row.triage.at,
      ...(row.triage.notes ? { detail: row.triage.notes } : {}),
      tone: row.triage.recommendation === "block" ? "danger" : "info",
    });
  }
  if (row.review?.at) {
    events.push({
      id: "decision",
      title: `MLRO decision: ${row.decision.label.toLowerCase()}`,
      at: row.review.at,
      ...(row.review.notes ? { detail: row.review.notes } : {}),
      tone: row.decision.tone,
    });
  }
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Work waiting beside the screenings, each linking to the list that holds it. */
export function amlAttention(counts: {
  manualReviewCount: number;
  sourceOfFundsPending: number;
}): AttentionStripItem[] {
  return [
    {
      id: "manual-review",
      count: counts.manualReviewCount,
      label:
        counts.manualReviewCount === 1
          ? "payment is held for manual review"
          : "payments are held for manual review",
      href: "/admin/payments?manualReview=1",
      tone: "warning",
    },
    {
      id: "source-of-funds",
      count: counts.sourceOfFundsPending,
      label:
        counts.sourceOfFundsPending === 1
          ? "source of funds case is pending"
          : "source of funds cases are pending",
      href: "/admin/compliance/source-of-funds",
    },
  ];
}

/** The pending queue in four numbers: its two stages, the block recommendations, the total. */
export function amlMetrics(summary: AdminAmlListSummary): Metric[] {
  const count = new Intl.NumberFormat("en-GB");
  return [
    { id: "awaiting", label: "Awaiting triage", value: count.format(summary.awaitingTriage) },
    { id: "triaged", label: "Awaiting MLRO decision", value: count.format(summary.triaged) },
    { id: "escalated", label: "Recommended block", value: count.format(summary.escalated) },
    { id: "total", label: "Pending in total", value: count.format(summary.total) },
  ];
}

/** "1–50 of 312 screenings". */
export function amlRangeSummary(offset: number, shown: number, total: number): string {
  const count = new Intl.NumberFormat("en-GB");
  const noun = total === 1 ? "screening" : "screenings";
  return `${count.format(offset + 1)}–${count.format(offset + shown)} of ${count.format(total)} ${noun}`;
}
