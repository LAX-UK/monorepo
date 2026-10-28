import {
  type ReviewStage,
  parseReviewStage,
} from "@/lib/organisation-home/consignment-stage-links";
import { lotPath } from "@/lib/seo/url";
import {
  type ConsignmentProgressStage,
  lotProgressStage,
  submissionProgressStage,
} from "@auction/domain";
import type { ItemSubmission, ItemSubmissionStatus, Lot } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";

/**
 * A consignment is one thing a seller handed to LAX, seen at whatever stage it has reached:
 * a submission while it is being reviewed, then a lot once it is catalogued and in or past a sale.
 * Status tabs group those stages for people who do not think in "submissions" and "lots".
 */
export const CONSIGNMENT_TABS = [
  "all",
  "drafts",
  "in-review",
  "in-sale",
  "sold",
  "unsold",
  "closed",
] as const;

export type ConsignmentTab = (typeof CONSIGNMENT_TABS)[number];

const TAB_LABELS: Record<ConsignmentTab, string> = {
  all: "All",
  drafts: "Drafts",
  "in-review": "In review",
  "in-sale": "In sale",
  sold: "Sold",
  unsold: "Unsold",
  closed: "Closed",
};

export function consignmentTabLabel(tab: ConsignmentTab): string {
  return TAB_LABELS[tab];
}

/** Tabs a row can belong to; "all" is a view over every row, not a stage. */
type ConsignmentStage = Exclude<ConsignmentTab, "all">;

export type ConsignmentRow = {
  /** Stable across both sources, since a submission and a lot may share an id space. */
  key: string;
  kind: "submission" | "lot";
  title: string;
  stage: ConsignmentStage;
  /** Where it is between first review and sale, or `null` for drafts and closed work. */
  progress: ConsignmentProgressStage | null;
  statusLabel: string;
  statusTone: DotStatusPillTone;
  href: string;
  /** ISO timestamp used to put the most recently changed first. */
  changedAtIso: string;
};

type StageView = { stage: ConsignmentStage; label: string; tone: DotStatusPillTone };

const SUBMISSION_STAGES: Record<ItemSubmissionStatus, StageView> = {
  draft: { stage: "drafts", label: "Draft", tone: "draft" },
  submitted: { stage: "in-review", label: "Submitted", tone: "pending" },
  under_review: { stage: "in-review", label: "Under review", tone: "pending" },
  changes_requested: { stage: "in-review", label: "Needs changes", tone: "warning" },
  approved: { stage: "in-review", label: "Accepted", tone: "success" },
  converted: { stage: "in-review", label: "Preparing catalogue", tone: "info" },
  rejected: { stage: "closed", label: "Not accepted", tone: "critical" },
  withdrawn: { stage: "closed", label: "Withdrawn", tone: "neutral" },
};

function lotStage(lot: Pick<Lot, "status" | "winnerId">): StageView {
  switch (lot.status) {
    case "draft":
      return { stage: "in-review", label: "Preparing catalogue", tone: "info" };
    case "scheduled":
      return { stage: "in-sale", label: "Scheduled", tone: "pending" };
    case "active":
      return { stage: "in-sale", label: "Live", tone: "live" };
    case "ended":
      return lot.winnerId
        ? { stage: "sold", label: "Sold", tone: "sold" }
        : { stage: "unsold", label: "Did not sell", tone: "warning" };
    case "cancelled":
      return { stage: "closed", label: "Cancelled", tone: "neutral" };
    case "voided":
      return { stage: "closed", label: "Voided", tone: "neutral" };
  }
}

export function submissionToConsignmentRow(submission: ItemSubmission): ConsignmentRow {
  const view = SUBMISSION_STAGES[submission.status];
  return {
    key: `submission:${submission.id}`,
    kind: "submission",
    title: submission.title,
    stage: view.stage,
    progress: submissionProgressStage(submission.status),
    statusLabel: view.label,
    statusTone: view.tone,
    href: `/selling/consignments/${submission.id}`,
    changedAtIso: submission.updatedAt.toISOString(),
  };
}

export function lotToConsignmentRow(lot: Lot): ConsignmentRow {
  const view = lotStage(lot);
  // A lot has no "updated" time of its own in this projection, so its end is the best anchor.
  return {
    key: `lot:${lot.id}`,
    kind: "lot",
    title: lot.title,
    stage: view.stage,
    progress: lotProgressStage({ status: lot.status, sold: Boolean(lot.winnerId) }),
    statusLabel: view.label,
    statusTone: view.tone,
    href: lotPath({ id: lot.id, title: lot.title }),
    changedAtIso: lot.endTime.toISOString(),
  };
}

/**
 * Merges submissions and lots into one newest-first list. A converted submission is dropped
 * when its lot is in the list, so one item never appears twice.
 */
export function buildConsignmentRows(input: {
  submissions: readonly ItemSubmission[];
  lots: readonly Lot[];
}): ConsignmentRow[] {
  const lotIds = new Set(input.lots.map((lot) => lot.id));
  const submissionRows = input.submissions
    .filter((s) => !(s.convertedLotId && lotIds.has(s.convertedLotId)))
    .map(submissionToConsignmentRow);
  const lotRows = input.lots.map(lotToConsignmentRow);
  return [...submissionRows, ...lotRows].sort((a, b) =>
    b.changedAtIso.localeCompare(a.changedAtIso),
  );
}

/** The rows in a tab, narrowed to one review stage when one is chosen. */
export function filterConsignmentRows(
  rows: readonly ConsignmentRow[],
  tab: ConsignmentTab,
  reviewStage: ReviewStage | null = null,
): ConsignmentRow[] {
  const inTab = tab === "all" ? [...rows] : rows.filter((row) => row.stage === tab);
  return reviewStage ? inTab.filter((row) => row.progress === reviewStage) : inTab;
}

export function countConsignmentsByTab(
  rows: readonly ConsignmentRow[],
): Record<ConsignmentTab, number> {
  const counts: Record<ConsignmentTab, number> = {
    all: rows.length,
    drafts: 0,
    "in-review": 0,
    "in-sale": 0,
    sold: 0,
    unsold: 0,
    closed: 0,
  };
  for (const row of rows) counts[row.stage] += 1;
  return counts;
}

/** Submission statuses used by the retired submissions list, so old links still land sensibly. */
const LEGACY_STATUS_TABS: Partial<Record<string, ConsignmentTab>> = {
  draft: "drafts",
  submitted: "in-review",
  under_review: "in-review",
  approved: "in-review",
  converted: "in-review",
  rejected: "closed",
  withdrawn: "closed",
};

/** Reads `?tab=`, falling back to the retired `?status=` so old bookmarks keep their meaning. */
export function parseConsignmentTab(params: { tab?: string; status?: string }): ConsignmentTab {
  const tab = CONSIGNMENT_TABS.find((candidate) => candidate === params.tab);
  if (tab) return tab;
  return (params.status ? LEGACY_STATUS_TABS[params.status] : undefined) ?? "all";
}

/** The list's filter: a tab, and within "In review" optionally one stage (`?stage=`). */
export type ConsignmentListFilter = { tab: ConsignmentTab; reviewStage: ReviewStage | null };

/** Reads the tab and the review stage; a stage alone opens the In review tab. */
export function parseConsignmentFilter(params: {
  tab?: string;
  status?: string;
  stage?: string;
}): ConsignmentListFilter {
  const reviewStage = parseReviewStage(params.stage);
  const tab = parseConsignmentTab(params);
  if (!reviewStage) return { tab, reviewStage: null };
  return tab === "in-review" || params.tab === undefined
    ? { tab: "in-review", reviewStage }
    : { tab, reviewStage: null };
}
