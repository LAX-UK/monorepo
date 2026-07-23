import {
  type AdminAmlScreeningRow,
  adminAmlScreeningRowSchema,
} from "@/lib/data/http/compliance-aml.schema";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { z } from "zod";

export type AdminAmlListSummary = {
  total: number;
  awaitingTriage: number;
  triaged: number;
  escalated: number;
};

export type AdminAmlPageParams = {
  limit: number;
  offset: number;
};

export type AdminAmlPage = {
  rows: AdminAmlScreeningRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminAmlListSummary;
  hasNextPage: boolean;
};

export const EMPTY_ADMIN_AML_LIST_SUMMARY: AdminAmlListSummary = {
  total: 0,
  awaitingTriage: 0,
  triaged: 0,
  escalated: 0,
};

const summarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  awaitingTriage: z.coerce.number().int().nonnegative(),
  triaged: z.coerce.number().int().nonnegative(),
  escalated: z.coerce.number().int().nonnegative(),
});

function parseAmlListSummary(value: unknown): AdminAmlListSummary {
  const parsed = summarySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid AML list summary in API response");
  }
  const summary = parsed.data;
  if (summary.awaitingTriage + summary.triaged !== summary.total) {
    throw new Error("AML list summary buckets do not partition the pending queue");
  }
  return summary;
}

export function buildAdminAmlSearchParams(params: AdminAmlPageParams): URLSearchParams {
  return new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
}

export function parseAdminAmlPageBody(body: unknown, params: AdminAmlPageParams): AdminAmlPage {
  const envelope = isIndexableObject(body) ? body : {};
  const rows = Array.isArray(envelope.data)
    ? envelope.data
        .map((row) => adminAmlScreeningRowSchema.parse(row))
        .filter((row): row is AdminAmlScreeningRow => row != null)
    : [];
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const summary = parseAmlListSummary(meta.summary);
  const total = Number(meta.total);
  if (!Number.isFinite(total)) {
    throw new Error("Invalid AML list total in API response");
  }
  if (total !== summary.total) {
    throw new Error("AML list total does not match summary total");
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
