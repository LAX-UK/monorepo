import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { type SQL, and, asc, count, eq, ilike } from "drizzle-orm";
import type { IAdminLegalEntityBrowseReader } from "../interfaces/admin-legal-entity-browse.reader.js";
import type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
  AdminLegalEntityBrowseRow,
} from "../lib/admin-legal-entity-browse.types.js";
import {
  stripeConnectHasOutstandingExpr,
  stripeConnectOutstandingCountExpr,
} from "../lib/stripe-connect-requirements-sql.js";

const stripeDueCountExpr = stripeConnectOutstandingCountExpr;
const stripeDueFilterExpr = stripeConnectHasOutstandingExpr;

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
    clauses.push(stripeDueFilterExpr);
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export class DrizzleAdminLegalEntityBrowseReader implements IAdminLegalEntityBrowseReader {
  constructor(private readonly db: Database) {}

  async searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult> {
    const limit = Math.min(Math.max(params.limit, 1), 50);
    const offset = Math.max(params.offset, 0);
    const whereClause = buildBrowseWhere(params);

    const countQuery = this.db.select({ n: count() }).from(legalEntity);
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

    const base = this.db.select(cols).from(legalEntity);
    const filtered = whereClause ? base.where(whereClause) : base;
    const rows = await filtered.orderBy(asc(legalEntity.displayName)).limit(limit).offset(offset);

    return {
      total,
      rows: rows.map(
        (r): AdminLegalEntityBrowseRow => ({
          id: r.id,
          displayName: r.displayName,
          status: r.status,
          kind: r.kind,
          subkind: r.subkind,
          updatedAt: r.updatedAt,
          stripeDueCount: Number(r.stripeDueCount ?? 0),
        }),
      ),
    };
  }
}
