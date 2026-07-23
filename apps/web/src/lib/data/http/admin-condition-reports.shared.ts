import { isIndexableObject } from "@/lib/data/http/object-guards";
import { z } from "zod";

const crStatuses = ["pending", "in_progress", "fulfilled", "declined"] as const;

export type AdminConditionReportRequestRow = {
  id: string;
  lotId: string;
  requestedByUserId: string;
  requestingLegalEntityId: string | null;
  status: (typeof crStatuses)[number];
  requestNote: string | null;
  responseNote: string | null;
  responseAttachmentUploadId: string | null;
  fulfilledByUserId: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  lotTitle: string | null;
  requesterEmail: string | null;
};

export type AdminConditionReportListSummary = {
  total: number;
  open: number;
  pending: number;
  inProgress: number;
  fulfilled: number;
  declined: number;
};

export type AdminConditionReportsPageParams = {
  limit: number;
  offset: number;
  status?: "open" | AdminConditionReportRequestRow["status"];
  lotId?: string;
};

export type AdminConditionReportsPage = {
  rows: AdminConditionReportRequestRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminConditionReportListSummary;
  hasNextPage: boolean;
};

export const EMPTY_ADMIN_CONDITION_REPORT_LIST_SUMMARY: AdminConditionReportListSummary = {
  total: 0,
  open: 0,
  pending: 0,
  inProgress: 0,
  fulfilled: 0,
  declined: 0,
};

const rowSchema = z.object({
  id: z.coerce.string(),
  lotId: z.coerce.string(),
  requestedByUserId: z.coerce.string(),
  requestingLegalEntityId: z.union([z.null(), z.coerce.string()]),
  status: z.enum(crStatuses),
  requestNote: z.union([z.null(), z.coerce.string()]),
  responseNote: z.union([z.null(), z.coerce.string()]),
  responseAttachmentUploadId: z.union([z.null(), z.coerce.string()]),
  fulfilledByUserId: z.union([z.null(), z.coerce.string()]),
  fulfilledAt: z.union([z.null(), z.coerce.string()]),
  createdAt: z.coerce.string(),
  lotTitle: z.union([z.null(), z.coerce.string()]),
  requesterEmail: z.union([z.null(), z.coerce.string()]),
});

const summarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  open: z.coerce.number().int().nonnegative(),
  pending: z.coerce.number().int().nonnegative(),
  inProgress: z.coerce.number().int().nonnegative(),
  fulfilled: z.coerce.number().int().nonnegative(),
  declined: z.coerce.number().int().nonnegative(),
});

function parseSummary(value: unknown): AdminConditionReportListSummary {
  const parsed = summarySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid condition report list summary in API response");
  }
  const summary = parsed.data;
  if (summary.pending + summary.inProgress !== summary.open) {
    throw new Error("Condition report open count does not match pending + in progress");
  }
  return summary;
}

export function buildAdminConditionReportsSearchParams(
  params: AdminConditionReportsPageParams,
): URLSearchParams {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.status) qs.set("status", params.status);
  if (params.lotId) qs.set("lotId", params.lotId);
  return qs;
}

export function parseAdminConditionReportsPageBody(
  body: unknown,
  params: AdminConditionReportsPageParams,
): AdminConditionReportsPage {
  const envelope = isIndexableObject(body) ? body : {};
  const rows = Array.isArray(envelope.data) ? envelope.data.map((row) => rowSchema.parse(row)) : [];
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const summary = parseSummary(meta.summary);
  const total = Number(meta.total);
  if (!Number.isFinite(total)) {
    throw new Error("Invalid condition report list total in API response");
  }
  const limit = Number(meta.limit ?? params.limit);
  const offset = Number(meta.offset ?? params.offset);
  return {
    rows,
    total,
    offset,
    limit,
    summary,
    hasNextPage: offset + rows.length < total,
  };
}
