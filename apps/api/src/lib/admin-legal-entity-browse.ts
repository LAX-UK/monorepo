import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { type SQL, and, asc, eq, ilike } from "drizzle-orm";

export type AdminLegalEntityBrowseRow = {
  id: string;
  displayName: string;
  status: string;
};

export type AdminLegalEntityBrowseParams = {
  q?: string;
  /** When set, only entities created by this user. */
  createdByUserId?: string;
  limit: number;
  offset: number;
};

/** Platform-admin list/search for picker UIs (minimal columns). */
export async function searchLegalEntitiesForAdminBrowse(
  db: Database,
  params: AdminLegalEntityBrowseParams,
): Promise<AdminLegalEntityBrowseRow[]> {
  const trimmed = params.q?.trim() ?? "";
  const limit = Math.min(Math.max(params.limit, 1), 50);
  const offset = Math.max(params.offset, 0);

  const cols = {
    id: legalEntity.id,
    displayName: legalEntity.displayName,
    status: legalEntity.status,
  };

  const clauses: SQL[] = [];
  if (trimmed.length > 0) {
    clauses.push(ilike(legalEntity.displayName, `%${trimmed}%`));
  }
  if (params.createdByUserId?.trim()) {
    clauses.push(eq(legalEntity.createdByUserId, params.createdByUserId.trim()));
  }
  const whereClause = clauses.length > 0 ? and(...clauses) : undefined;

  const base = db.select(cols).from(legalEntity);
  const filtered = whereClause ? base.where(whereClause) : base;
  const rows = await filtered.orderBy(asc(legalEntity.displayName)).limit(limit).offset(offset);

  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    status: r.status,
  }));
}
