import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  CONDITION_REPORTS_LIST_PATH,
  type ConditionReportLens,
} from "@/lib/admin/build-condition-reports-list-page-model";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type {
  AdminConditionReportListSummary,
  AdminConditionReportRequestRow,
} from "@/lib/data/http/admin-condition-reports.shared";
import type {
  AttentionStripItem,
  Metric,
  DataView as StaffDataView,
  StatusPresentation,
} from "@auction/staff-ui";

export type ConditionReportsListSearch = Record<string, string | string[] | undefined>;

export type ConditionReportStatusCode = AdminConditionReportRequestRow["status"];

/** One buyer request as the staff list shows it; plain data, so it crosses to the client as is. */
export type ConditionReportStaffRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  requester: string | null;
  requesterHref: string;
  requestedAt: string;
  statusCode: ConditionReportStatusCode;
  status: StatusPresentation;
  /** The buyer's question, when they wrote one. */
  requestNote: string | null;
  /** Staff's answer: the decline reason, or the internal note kept on fulfilment. */
  responseNote: string | null;
  fulfilledAt: string | null;
  lotHref: string;
  /** Fulfilled or declined: nothing more for staff to do. */
  closed: boolean;
};

const count = new Intl.NumberFormat("en-GB");

export function toConditionReportStaffRows(
  rows: readonly AdminConditionReportRequestRow[],
): ConditionReportStaffRow[] {
  return rows.map((row) => ({
    id: row.id,
    lotId: row.lotId,
    lotTitle: row.lotTitle?.trim() || "Untitled lot",
    requester: row.requesterEmail?.trim() || null,
    requesterHref: `/admin/clients/${row.requestedByUserId}`,
    requestedAt: row.createdAt,
    statusCode: row.status,
    status: staffStatus("conditionReport", row.status),
    requestNote: row.requestNote?.trim() || null,
    responseNote: row.responseNote?.trim() || null,
    fulfilledAt: row.fulfilledAt,
    lotHref: `/admin/lots/${row.lotId}`,
    closed: row.status === "fulfilled" || row.status === "declined",
  }));
}

/** The list URL with `patch` applied; any change returns to the first page. */
export function conditionReportsListHref(
  current: ConditionReportsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: ConditionReportsListSearch = { ...current };
  for (const key of ["error", "success", "request"]) delete base[key];
  return buildListHref(CONDITION_REPORTS_LIST_PATH, base, { offset: null, ...patch });
}

/** The list with a request's panel open (`?request=`), or closed for null; keeps the page. */
export function conditionReportPanelHref(
  current: ConditionReportsListSearch,
  requestId: string | null,
): string {
  const base: ConditionReportsListSearch = { ...current };
  for (const key of ["error", "success"]) delete base[key];
  return buildListHref(CONDITION_REPORTS_LIST_PATH, base, { request: requestId });
}

const LENSES: ReadonlyArray<{
  id: ConditionReportLens;
  label: string;
  total: (summary: AdminConditionReportListSummary) => number;
}> = [
  { id: "open", label: "Open", total: (s) => s.open },
  { id: "pending", label: "Requested", total: (s) => s.pending },
  { id: "in_progress", label: "In progress", total: (s) => s.inProgress },
  { id: "fulfilled", label: "Fulfilled", total: (s) => s.fulfilled },
  { id: "declined", label: "Declined", total: (s) => s.declined },
];

/** The status views as tabs, each with its count; "Open" is the default and has no param. */
export function conditionReportsViews(
  search: ConditionReportsListSearch,
  summary: AdminConditionReportListSummary | null,
): StaffDataView[] {
  return LENSES.map((lens) => ({
    id: lens.id,
    label: lens.label,
    href: conditionReportsListHref(search, { lens: lens.id === "open" ? null : lens.id }),
    ...(summary ? { count: lens.total(summary) } : {}),
  }));
}

/** Requests nobody has picked up yet, linking to the view that holds them. */
export function conditionReportsAttention(
  search: ConditionReportsListSearch,
  summary: AdminConditionReportListSummary,
): AttentionStripItem[] {
  const waiting = summary.pending;
  return [
    {
      id: "waiting",
      count: waiting,
      label:
        waiting === 1
          ? "request is waiting to be picked up"
          : "requests are waiting to be picked up",
      href: conditionReportsListHref(search, { lens: "pending" }),
      actionLabel: "Review",
      tone: "warning",
    },
  ];
}

/** Headline numbers across every request; the total is the All requests tab's count. */
export function conditionReportsMetrics(summary: AdminConditionReportListSummary): Metric[] {
  return [
    { id: "open", label: "Open", value: count.format(summary.open) },
    { id: "fulfilled", label: "Fulfilled", value: count.format(summary.fulfilled) },
    { id: "declined", label: "Declined", value: count.format(summary.declined) },
  ];
}

/** What an empty view says, by view. */
export function conditionReportsEmpty(lens: ConditionReportLens): {
  title: string;
  description: string;
} {
  switch (lens) {
    case "open":
      return {
        title: "No open requests",
        description: "Buyer requests for a condition report will appear here.",
      };
    case "pending":
      return {
        title: "No requests waiting",
        description: "Every request has been picked up.",
      };
    case "in_progress":
      return {
        title: "Nothing in progress",
        description: "Requests you mark as in progress will appear here.",
      };
    case "fulfilled":
      return {
        title: "No fulfilled requests yet",
        description: "Requests you fulfil are kept here.",
      };
    case "declined":
      return {
        title: "No declined requests",
        description: "Requests you decline are kept here.",
      };
  }
}

/** "1–50 of 312 requests", with the singular for one. */
export function conditionReportsRangeSummary(offset: number, shown: number, total: number) {
  const range = `${count.format(offset + 1)}–${count.format(offset + shown)}`;
  return `${range} of ${count.format(total)} ${total === 1 ? "request" : "requests"}`;
}

/** The first view of the list: newest requests first. */
export const CONDITION_REPORTS_DEFAULT_SORT = { columnId: "requested", direction: "desc" as const };
