import type { AdminPayoutRow } from "@/lib/data/http/admin-parse.server";
import { parseAdminPayoutRow } from "@/lib/data/http/admin-parse.server";
import { adminPayoutRowsSchema } from "@/lib/data/http/admin-payments.schema";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { PayoutStatus } from "@auction/types";
import { z } from "zod";

export type AdminPayoutListSummary = {
  total: number;
  scheduled: number;
  inTransit: number;
  paid: number;
  failed: number;
  reversed: number;
  clawbackPending: number;
  totalNet: string;
  readiness: {
    inFlightCount: number;
    missingTransferRefCount: number;
    withFailureReasonCount: number;
    withStatementErrorCount: number;
    clawbackCount: number;
    failedCount: number;
    reversedCount: number;
    blockerPayoutCount: number;
  };
};

export type AdminPayoutsPageParams = {
  limit: number;
  offset: number;
  status?: PayoutStatus;
  legalEntityId?: string;
};

export type AdminPayoutsPage = {
  rows: AdminPayoutRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminPayoutListSummary;
  hasNextPage: boolean;
};

export type AdminSettlementPreview = {
  pending: {
    pendingGross: string;
    pendingPlatformFee: string;
    pendingNet: string;
    paymentCount: number;
    currency: string;
  };
  openPayout: AdminPayoutRow | null;
};

const EMPTY_SUMMARY: AdminPayoutListSummary = {
  total: 0,
  scheduled: 0,
  inTransit: 0,
  paid: 0,
  failed: 0,
  reversed: 0,
  clawbackPending: 0,
  totalNet: "0",
  readiness: {
    inFlightCount: 0,
    missingTransferRefCount: 0,
    withFailureReasonCount: 0,
    withStatementErrorCount: 0,
    clawbackCount: 0,
    failedCount: 0,
    reversedCount: 0,
    blockerPayoutCount: 0,
  },
};

const readinessSchema = z.object({
  inFlightCount: z.coerce.number(),
  missingTransferRefCount: z.coerce.number(),
  withFailureReasonCount: z.coerce.number(),
  withStatementErrorCount: z.coerce.number(),
  clawbackCount: z.coerce.number(),
  failedCount: z.coerce.number(),
  reversedCount: z.coerce.number(),
  blockerPayoutCount: z.coerce.number(),
});

const summarySchema = z.object({
  total: z.coerce.number(),
  scheduled: z.coerce.number(),
  inTransit: z.coerce.number(),
  paid: z.coerce.number(),
  failed: z.coerce.number(),
  reversed: z.coerce.number(),
  clawbackPending: z.coerce.number(),
  totalNet: z.coerce.string(),
  readiness: readinessSchema,
});

export function buildAdminPayoutsSearchParams(params: AdminPayoutsPageParams): URLSearchParams {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.status) qs.set("status", params.status);
  if (params.legalEntityId) qs.set("legalEntityId", params.legalEntityId);
  return qs;
}

export function parseAdminPayoutsPageBody(
  body: unknown,
  params: AdminPayoutsPageParams,
): AdminPayoutsPage {
  const envelope = isIndexableObject(body) ? body : {};
  const rows = Array.isArray(envelope.data) ? adminPayoutRowsSchema.parse(envelope.data) : [];
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const summaryParsed = summarySchema.safeParse(meta.summary);
  const summary = summaryParsed.success ? summaryParsed.data : EMPTY_SUMMARY;
  const total = Number(meta.total ?? rows.length);
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

const settlementPreviewSchema = z.object({
  pending: z.object({
    pendingGross: z.coerce.string(),
    pendingPlatformFee: z.coerce.string(),
    pendingNet: z.coerce.string(),
    paymentCount: z.coerce.number(),
    currency: z.coerce.string(),
  }),
  openPayout: z.union([z.null(), z.unknown()]).transform((value): AdminPayoutRow | null => {
    if (value == null) return null;
    return parseAdminPayoutRow(value);
  }),
});

export function parseAdminSettlementPreviewBody(body: unknown): AdminSettlementPreview {
  const envelope = isIndexableObject(body) ? body : {};
  const data = envelope.data;
  return settlementPreviewSchema.parse(data);
}

export { EMPTY_SUMMARY as EMPTY_ADMIN_PAYOUT_LIST_SUMMARY };
