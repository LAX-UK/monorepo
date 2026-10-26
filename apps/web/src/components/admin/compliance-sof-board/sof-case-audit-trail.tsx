"use client";

import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { type KeyValueItem, KeyValueList, StaffDate } from "@auction/staff-ui";

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail | null;
};

/** Who triaged and decided the case, when, and what they wrote. Nothing when no one has yet. */
export function SofCaseAuditTrail({ row, detail }: Props) {
  const triagedBy = detail?.triagedBy?.label ?? null;
  const reviewedBy = detail?.reviewedBy?.label ?? null;

  if (!row.triageRecommendation && !row.reviewedAt && !row.triageNotes && !row.reviewNotes) {
    return null;
  }

  const items: KeyValueItem[] = [];
  if (row.triageRecommendation) {
    items.push({ label: "Triage", value: row.triageLabel });
    if (triagedBy) items.push({ label: "Triaged by", value: triagedBy });
    if (row.triagedAt) {
      items.push({ label: "Triaged", value: <StaffDate value={row.triagedAt} withTime /> });
    }
    if (row.triageNotes) {
      items.push({
        label: "Triage notes",
        value: <span className="whitespace-pre-wrap">{row.triageNotes}</span>,
      });
    }
  }
  if (row.reviewedAt) {
    items.push({ label: "MLRO decision", value: row.statusLabel });
    if (reviewedBy) items.push({ label: "Decided by", value: reviewedBy });
    items.push({ label: "Decided", value: <StaffDate value={row.reviewedAt} withTime /> });
    if (row.reviewNotes) {
      items.push({
        label: "Decision notes",
        value: <span className="whitespace-pre-wrap">{row.reviewNotes}</span>,
      });
    }
  }
  return <KeyValueList items={items} />;
}
