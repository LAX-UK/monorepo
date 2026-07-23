import {
  type AdminSourceOfFundsRow,
  adminSourceOfFundsRowSchema,
} from "@/lib/data/http/compliance-sof.schema";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { z } from "zod";

export type AdminSourceOfFundsListSummary = {
  total: number;
  awaitingTriage: number;
  triaged: number;
};

export type AdminSourceOfFundsPageParams = {
  status: "pending" | "rejected" | "approved";
  limit: number;
  offset: number;
};

export type AdminSourceOfFundsPage = {
  rows: AdminSourceOfFundsRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminSourceOfFundsListSummary;
  hasNextPage: boolean;
};

export const EMPTY_ADMIN_SOF_LIST_SUMMARY: AdminSourceOfFundsListSummary = {
  total: 0,
  awaitingTriage: 0,
  triaged: 0,
};

const summarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  awaitingTriage: z.coerce.number().int().nonnegative(),
  triaged: z.coerce.number().int().nonnegative(),
});

function parseSofListSummary(value: unknown): AdminSourceOfFundsListSummary {
  const parsed = summarySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid Source of Funds list summary in API response");
  }
  const summary = parsed.data;
  if (summary.awaitingTriage + summary.triaged !== summary.total) {
    throw new Error("Source of Funds list summary buckets do not partition the queue");
  }
  return summary;
}

export function buildAdminSourceOfFundsSearchParams(
  params: AdminSourceOfFundsPageParams,
): URLSearchParams {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    status: params.status,
  });
  return qs;
}

export function parseAdminSourceOfFundsPageBody(
  body: unknown,
  params: AdminSourceOfFundsPageParams,
): AdminSourceOfFundsPage {
  const envelope = isIndexableObject(body) ? body : {};
  const rows = Array.isArray(envelope.data)
    ? envelope.data
        .map((row) => adminSourceOfFundsRowSchema.parse(row))
        .filter((row): row is AdminSourceOfFundsRow => row != null)
    : [];
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const summary = parseSofListSummary(meta.summary);
  const total = Number(meta.total);
  if (!Number.isFinite(total)) {
    throw new Error("Invalid Source of Funds list total in API response");
  }
  if (total !== summary.total) {
    throw new Error("Source of Funds list total does not match summary total");
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
