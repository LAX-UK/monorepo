import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import type { LegalEntityKind, LegalEntityStatus } from "@auction/types";
import { type SQL, and, asc, count, eq, ilike, sql } from "drizzle-orm";

export type AdminLegalEntityBrowseRow = {
  id: string;
  displayName: string;
  status: string;
  kind: string;
  subkind: string;
  updatedAt: Date;
  stripeDueCount: number;
};

export type AdminLegalEntityBrowseResult = {
  rows: AdminLegalEntityBrowseRow[];
  total: number;
};

export type AdminLegalEntityBrowseParams = {
  q?: string;
  /** When set, only entities created by this user. */
  createdByUserId?: string;
  status?: LegalEntityStatus;
  kind?: LegalEntityKind;
  stripeDue?: boolean;
  limit: number;
  offset: number;
};

const stripeDueCountExpr = sql<number>`jsonb_array_length(${legalEntity.stripeConnectRequirementsCurrentlyDue})`;

function buildBrowseWhere(params: AdminLegalEntityBrowseParams): SQL | undefined {
  const trimmed = params.q?.trim() ?? "";
  const clauses: SQL[] = [];

  if (trimmed.length > 0) {
    clauses.push(ilike(legalEntity.displayName, `%${trimmed}%`));
  }
  if (params.createdByUserId?.trim()) {
    clauses.push(eq(legalEntity.createdByUserId, params.createdByUserId.trim()));
  }
  if (params.status) {
    clauses.push(eq(legalEntity.status, params.status));
  }
  if (params.kind) {
    clauses.push(eq(legalEntity.kind, params.kind));
  }
  if (params.stripeDue) {
    clauses.push(sql`jsonb_array_length(${legalEntity.stripeConnectRequirementsCurrentlyDue}) > 0`);
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

/** Platform-admin paginated list/search for directory and picker UIs. */
export async function searchLegalEntitiesForAdminBrowse(
  db: Database,
  params: AdminLegalEntityBrowseParams,
): Promise<AdminLegalEntityBrowseResult> {
  const limit = Math.min(Math.max(params.limit, 1), 50);
  const offset = Math.max(params.offset, 0);
  const whereClause = buildBrowseWhere(params);

  const countQuery = db.select({ n: count() }).from(legalEntity);
  const [countRow] = whereClause ? await countQuery.where(whereClause) : await countQuery;
  const total = Number(countRow?.n ?? 0);

  const cols = {
    id: legalEntity.id,
    displayName: legalEntity.displayName,
    status: legalEntity.status,
    kind: legalEntity.kind,
    subkind: legalEntity.subkind,
    updatedAt: legalEntity.updatedAt,
    stripeDueCount: stripeDueCountExpr,
  };

  const base = db.select(cols).from(legalEntity);
  const filtered = whereClause ? base.where(whereClause) : base;
  const rows = await filtered.orderBy(asc(legalEntity.displayName)).limit(limit).offset(offset);

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      status: r.status,
      kind: r.kind,
      subkind: r.subkind,
      updatedAt: r.updatedAt,
      stripeDueCount: Number(r.stripeDueCount ?? 0),
    })),
  };
}
