import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { asc, ilike } from "drizzle-orm";

export type AdminLegalEntityBrowseRow = {
  id: string;
  displayName: string;
  status: string;
};

export type AdminLegalEntityBrowseParams = {
  q?: string;
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

  const rows =
    trimmed.length > 0
      ? await db
          .select(cols)
          .from(legalEntity)
          .where(ilike(legalEntity.displayName, `%${trimmed}%`))
          .orderBy(asc(legalEntity.displayName))
          .limit(limit)
          .offset(offset)
      : await db
          .select(cols)
          .from(legalEntity)
          .orderBy(asc(legalEntity.displayName))
          .limit(limit)
          .offset(offset);

  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    status: r.status,
  }));
}
