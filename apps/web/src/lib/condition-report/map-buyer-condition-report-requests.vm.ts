import { conditionReportStatusLabel } from "@/lib/condition-report/condition-report-status-labels";
import type { ConditionReportRequestStatus } from "@/lib/condition-report/condition-report-types";
import { lotPath } from "@/lib/seo/url";

export type BuyerConditionReportRequestRowDto = {
  id: string;
  lotId: string;
  status: ConditionReportRequestStatus;
  requestNote: string | null;
  responseNote: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  lotTitle: string;
  lotNumber: number | null;
  downloadUrl: string | null;
};

export type BuyerConditionReportRequestVM = {
  id: string;
  lotId: string;
  lotTitle: string;
  lotHref: string;
  lotNumberLabel: string | null;
  status: ConditionReportRequestStatus;
  statusLabel: string;
  requestedAtLabel: string;
  responseNote: string | null;
  downloadUrl: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function isSafeDownloadUrl(url: string | null): url is string {
  if (!url || url.trim() === "") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function mapBuyerConditionReportRequestsVM(
  rows: BuyerConditionReportRequestRowDto[],
): BuyerConditionReportRequestVM[] {
  return rows.map((row) => ({
    id: row.id,
    lotId: row.lotId,
    lotTitle: row.lotTitle,
    lotHref: lotPath({ id: row.lotId, title: row.lotTitle }),
    lotNumberLabel: row.lotNumber != null ? `Lot ${row.lotNumber}` : null,
    status: row.status,
    statusLabel: conditionReportStatusLabel(row.status),
    requestedAtLabel: formatDate(row.createdAt),
    responseNote: row.responseNote,
    downloadUrl: isSafeDownloadUrl(row.downloadUrl) ? row.downloadUrl : null,
  }));
}
