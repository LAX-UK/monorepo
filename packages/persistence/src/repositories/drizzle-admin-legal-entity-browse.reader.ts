import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { type SQL, and, asc, eq, ilike, sql } from "drizzle-orm";
import type { IAdminLegalEntityBrowseReader } from "../interfaces/admin-legal-entity-browse.reader.js";
import type {
  AdminLegalEntityBrowseFilter,
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
  AdminLegalEntityBrowseRow,
  AdminLegalEntityBrowseSummary,
} from "../lib/admin-legal-entity-browse.types.js";
import {
  stripeConnectHasOutstandingExpr,
  stripeConnectOutstandingCountExpr,
} from "../lib/stripe-connect-requirements-sql.js";

const stripeDueCountExpr = stripeConnectOutstandingCountExpr;
const stripeDueFilterExpr = stripeConnectHasOutstandingExpr;

function buildBrowseWhere(params: AdminLegalEntityBrowseFilter): SQL | undefined {
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

const summarySelect = {
  total: sql<number>`count(*)::int`,
  lead: sql<number>`count(*) filter (where ${legalEntity.status} = 'lead')::int`,
  docs_requested: sql<number>`count(*) filter (where ${legalEntity.status} = 'docs_requested')::int`,
  docs_received: sql<number>`count(*) filter (where ${legalEntity.status} = 'docs_received')::int`,
  under_review: sql<number>`count(*) filter (where ${legalEntity.status} = 'under_review')::int`,
  connect_pending: sql<number>`count(*) filter (where ${legalEntity.status} = 'connect_pending')::int`,
  approved: sql<number>`count(*) filter (where ${legalEntity.status} = 'approved')::int`,
  restricted: sql<number>`count(*) filter (where ${legalEntity.status} = 'restricted')::int`,
  rejected: sql<number>`count(*) filter (where ${legalEntity.status} = 'rejected')::int`,
  archived: sql<number>`count(*) filter (where ${legalEntity.status} = 'archived')::int`,
  stripeDueCount: sql<number>`count(*) filter (where ${stripeDueFilterExpr})::int`,
  individual: sql<number>`count(*) filter (where ${legalEntity.kind} = 'individual')::int`,
  organisation: sql<number>`count(*) filter (where ${legalEntity.kind} = 'organisation')::int`,
};

function rowToSummary(row: {
  total: number;
  lead: number;
  docs_requested: number;
  docs_received: number;
  under_review: number;
  connect_pending: number;
  approved: number;
  restricted: number;
  rejected: number;
  archived: number;
  stripeDueCount: number;
  individual: number;
  organisation: number;
}): AdminLegalEntityBrowseSummary {
  return {
    total: row.total ?? 0,
    byStatus: {
      lead: row.lead ?? 0,
      docs_requested: row.docs_requested ?? 0,
      docs_received: row.docs_received ?? 0,
      under_review: row.under_review ?? 0,
      connect_pending: row.connect_pending ?? 0,
      approved: row.approved ?? 0,
      restricted: row.restricted ?? 0,
      rejected: row.rejected ?? 0,
      archived: row.archived ?? 0,
    },
    stripeDueCount: row.stripeDueCount ?? 0,
    byKind: {
      individual: row.individual ?? 0,
      organisation: row.organisation ?? 0,
    },
  };
}

export class DrizzleAdminLegalEntityBrowseReader implements IAdminLegalEntityBrowseReader {
  constructor(private readonly db: Database) {}

  async summarizeLegalEntitiesBrowse(
    filter: AdminLegalEntityBrowseFilter,
  ): Promise<AdminLegalEntityBrowseSummary> {
    const whereClause = buildBrowseWhere(filter);
    const base = this.db.select(summarySelect).from(legalEntity);
    const [row] = whereClause ? await base.where(whereClause) : await base;
    return rowToSummary(
      row ?? {
        total: 0,
        lead: 0,
        docs_requested: 0,
        docs_received: 0,
        under_review: 0,
        connect_pending: 0,
        approved: 0,
        restricted: 0,
        rejected: 0,
        archived: 0,
        stripeDueCount: 0,
        individual: 0,
        organisation: 0,
      },
    );
  }

  async searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult> {
    const limit = Math.min(Math.max(params.limit, 1), 50);
    const offset = Math.max(params.offset, 0);
    const filter: AdminLegalEntityBrowseFilter = {
      ...(params.q !== undefined ? { q: params.q } : {}),
      ...(params.createdByUserId !== undefined ? { createdByUserId: params.createdByUserId } : {}),
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.kind !== undefined ? { kind: params.kind } : {}),
      ...(params.stripeDue !== undefined ? { stripeDue: params.stripeDue } : {}),
    };
    const whereClause = buildBrowseWhere(filter);

    const [summary, rows] = await Promise.all([
      this.summarizeLegalEntitiesBrowse(filter),
      (async () => {
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
        return filtered.orderBy(asc(legalEntity.displayName)).limit(limit).offset(offset);
      })(),
    ]);

    return {
      total: summary.total,
      summary,
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
