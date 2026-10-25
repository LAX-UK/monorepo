import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { getAdminLegalEntitiesPage } from "@/lib/data/http/admin-legal-entities.reader";
import type {
  AdminLegalEntityListRow,
  AdminLegalEntityListSummary,
} from "@/lib/data/http/admin-legal-entities.shared";
import { parseStaffPageSize } from "@auction/staff-ui";
import {
  type LegalEntityKind,
  type LegalEntityStatus,
  legalEntityKinds,
  legalEntityStatuses,
} from "@auction/types";

export type LegalEntitiesListQuery = AdminListQueryBase & {
  status?: LegalEntityStatus | undefined;
  kind?: LegalEntityKind | undefined;
  /** The Stripe requirements view: only entities with requirements currently due. */
  stripeDue?: boolean | undefined;
};

export type LegalEntitiesListResult = {
  rows: AdminLegalEntityListRow[];
  total: number;
  offset: number;
  limit: number;
  hasNextPage: boolean;
  summary: AdminLegalEntityListSummary;
};

function oneOf<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  return value !== undefined && (values as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export const legalEntitiesListController: IAdminListController<
  AdminLegalEntityListRow,
  LegalEntitiesListQuery
> & { fetchPage(query: LegalEntitiesListQuery): Promise<LegalEntitiesListResult> } = {
  id: "legal-entities",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    return {
      ...base,
      limit: parseStaffPageSize(firstString(sp.limit)),
      status: oneOf(legalEntityStatuses, firstString(sp.status)),
      kind: oneOf(legalEntityKinds, firstString(sp.kind)),
      stripeDue: firstString(sp.stripe) === "1" ? true : undefined,
    };
  },
  async fetchPage(query) {
    const page = await getAdminLegalEntitiesPage({
      limit: query.limit,
      offset: query.offset,
      ...(query.q ? { q: query.q } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.stripeDue ? { stripeDue: true } : {}),
    });
    return {
      rows: page.rows,
      total: page.total,
      offset: page.offset,
      limit: page.limit,
      hasNextPage: page.hasNextPage,
      summary: page.summary,
    };
  },
  async fetch(query) {
    const page = await legalEntitiesListController.fetchPage(query);
    return {
      rows: page.rows,
      total: page.total,
      offset: page.offset,
      limit: page.limit,
      hasNextPage: page.hasNextPage,
    };
  },
};
