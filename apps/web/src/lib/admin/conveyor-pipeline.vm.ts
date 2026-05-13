import type { AdminConveyorPipelineRow } from "@/lib/data/http/admin.server";

export type ConveyorStageId =
  | "intake"
  | "submission"
  | "specialist"
  | "approved"
  | "content"
  | "live"
  | "done"
  | "blocked";

export type ConveyorColumnVm = {
  id: ConveyorStageId;
  title: string;
  hint: string;
  items: AdminConveyorPipelineRow[];
};

/** Map a joined submission+lot row to a single pipeline column. */
export function conveyorStageForRow(row: AdminConveyorPipelineRow): ConveyorStageId {
  const st = row.submissionStatus;
  if (st === "rejected" || st === "withdrawn") return "blocked";
  if (st === "draft") return "intake";
  if (st === "submitted") return "submission";
  if (st === "under_review") return "specialist";
  if (st === "approved") return "approved";
  if (st === "converted") {
    if (!row.lotId) return "blocked";
    if (row.artistReviewRequired || row.archivedSeller) return "blocked";
    const ls = row.lotStatus;
    if (ls === "cancelled" || ls === "voided") return "blocked";
    if (ls === "draft" || ls === "scheduled") return "content";
    if (ls === "active") return "live";
    if (ls === "ended") return "done";
    return "blocked";
  }
  return "blocked";
}

const COLUMNS: readonly Omit<ConveyorColumnVm, "items">[] = [
  {
    id: "intake",
    title: "Leads",
    hint: "Draft consignments in the seller workspace.",
  },
  {
    id: "submission",
    title: "Submitted",
    hint: "Awaiting triage / assignment.",
  },
  {
    id: "specialist",
    title: "Specialist",
    hint: "Under specialist review.",
  },
  {
    id: "approved",
    title: "Approved",
    hint: "Ready to convert to a catalogue lot.",
  },
  {
    id: "content",
    title: "Catalogue",
    hint: "Lot in draft or scheduled — content and publish prep.",
  },
  {
    id: "live",
    title: "Live",
    hint: "Lot is active in an auction.",
  },
  {
    id: "done",
    title: "Published / ended",
    hint: "Lot has closed (sold or unsold).",
  },
  {
    id: "blocked",
    title: "Blockers",
    hint: "Rejected, withdrawn, catalogue gates, or data issues.",
  },
] as const;

export function buildConveyorColumns(rows: AdminConveyorPipelineRow[]): ConveyorColumnVm[] {
  const buckets = new Map<ConveyorStageId, AdminConveyorPipelineRow[]>();
  for (const c of COLUMNS) {
    buckets.set(c.id, []);
  }
  for (const row of rows) {
    const stage = conveyorStageForRow(row);
    buckets.get(stage)?.push(row);
  }
  return COLUMNS.map((c) => ({
    ...c,
    items: buckets.get(c.id) ?? [],
  }));
}
