import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { LegalEntityKind, LegalEntityStatus, LegalEntitySubkind } from "@auction/types";
import { legalEntityKinds, legalEntityStatuses, legalEntitySubkinds } from "@auction/types";
import { z } from "zod";

export type AdminLegalEntityListRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
  kind: LegalEntityKind;
  subkind: LegalEntitySubkind;
  updatedAt: string;
  stripeDueCount: number;
};

export type AdminLegalEntityListSummary = {
  total: number;
  byStatus: Record<LegalEntityStatus, number>;
  stripeDueCount: number;
  byKind: Record<LegalEntityKind, number>;
};

export type AdminLegalEntitiesPageParams = {
  limit: number;
  offset: number;
  q?: string;
  status?: LegalEntityStatus;
  kind?: LegalEntityKind;
  stripeDue?: boolean;
  createdByUserId?: string;
};

export type AdminLegalEntitiesPage = {
  rows: AdminLegalEntityListRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminLegalEntityListSummary;
  hasNextPage: boolean;
};

export const EMPTY_ADMIN_LEGAL_ENTITIES_LIST_SUMMARY: AdminLegalEntityListSummary = {
  total: 0,
  byStatus: {
    lead: 0,
    docs_requested: 0,
    docs_received: 0,
    under_review: 0,
    connect_pending: 0,
    approved: 0,
    restricted: 0,
    rejected: 0,
    archived: 0,
  },
  stripeDueCount: 0,
  byKind: { individual: 0, organisation: 0 },
};

const statusSchema = z.enum(legalEntityStatuses);
const kindSchema = z.enum(legalEntityKinds);
const subkindSchema = z.enum(legalEntitySubkinds);

const rowSchema = z
  .object({
    id: z.coerce.string(),
    displayName: z.coerce.string(),
    status: statusSchema,
    kind: kindSchema,
    subkind: subkindSchema,
    updatedAt: z.coerce.string(),
    stripeDueCount: z.coerce.number().int().nonnegative(),
  })
  .transform(
    (row): AdminLegalEntityListRow => ({
      id: row.id,
      displayName: row.displayName,
      status: row.status,
      kind: row.kind,
      subkind: row.subkind,
      updatedAt: row.updatedAt,
      stripeDueCount: row.stripeDueCount,
    }),
  );

const byStatusSchema = z.object(
  Object.fromEntries(
    legalEntityStatuses.map((status) => [status, z.coerce.number().int().nonnegative()]),
  ),
) as unknown as z.ZodType<Record<LegalEntityStatus, number>>;

const byKindSchema = z.object(
  Object.fromEntries(legalEntityKinds.map((kind) => [kind, z.coerce.number().int().nonnegative()])),
) as unknown as z.ZodType<Record<LegalEntityKind, number>>;

const summarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  byStatus: byStatusSchema,
  stripeDueCount: z.coerce.number().int().nonnegative(),
  byKind: byKindSchema,
});

function parseSummary(value: unknown): AdminLegalEntityListSummary {
  const parsed = summarySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid legal entities list summary in API response");
  }
  return parsed.data;
}

export function buildAdminLegalEntitiesSearchParams(
  params: AdminLegalEntitiesPageParams,
): URLSearchParams {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.status) qs.set("status", params.status);
  if (params.kind) qs.set("kind", params.kind);
  if (params.stripeDue) qs.set("stripeDue", "1");
  if (params.createdByUserId) qs.set("createdByUserId", params.createdByUserId);
  return qs;
}

export function parseAdminLegalEntitiesPageBody(
  body: unknown,
  params: AdminLegalEntitiesPageParams,
): AdminLegalEntitiesPage {
  const envelope = isIndexableObject(body) ? body : {};
  const rows = Array.isArray(envelope.data) ? envelope.data.map((row) => rowSchema.parse(row)) : [];
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const summary = parseSummary(meta.summary);
  const total = Number(meta.total);
  if (!Number.isFinite(total)) {
    throw new Error("Invalid legal entities list total in API response");
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
