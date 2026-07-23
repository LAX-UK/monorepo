import "server-only";

import {
  type AmlListSearchParams,
  buildAmlListPageModel,
} from "@/lib/admin/compliance/build-aml-list-page-model";
import type { SessionUser } from "@/lib/data/contracts";
import {
  getAdminAmlScreeningById,
  getAdminAmlScreeningsPage,
} from "@/lib/data/http/compliance-aml.reader";
import { EMPTY_ADMIN_AML_LIST_SUMMARY } from "@/lib/data/http/compliance-aml.shared";
import {
  type AdminAmlTableRow,
  buildAdminAmlTableRow,
  buildAdminAmlTableRows,
} from "@/lib/data/view-models/admin-aml-table.vm";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

export async function loadAdminAmlListPage(sp: AmlListSearchParams, user: SessionUser) {
  const model = buildAmlListPageModel(sp);
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const capabilities = {
    canTriage: userHasAccessTo(role, staffRole, AML_REVIEW_ACCESS),
    canDecide: userHasAccessTo(role, staffRole, MLRO_DECISION_ACCESS),
    currentUserId: user.id,
  };

  try {
    const selectedId = model.selectedScreeningId;
    const needsSelectedFetch = selectedId != null && selectedId.length > 0;
    const [page, selectedRow] = await Promise.all([
      getAdminAmlScreeningsPage(model.listQueryParams),
      needsSelectedFetch ? getAdminAmlScreeningById(selectedId) : Promise.resolve(null),
    ]);
    const rows: AdminAmlTableRow[] = buildAdminAmlTableRows(page.rows);
    const selectedFromPage = selectedId
      ? (rows.find((row) => row.id === selectedId) ?? null)
      : null;
    const selected = selectedFromPage ?? (selectedRow ? buildAdminAmlTableRow(selectedRow) : null);
    return {
      model,
      rows,
      selected,
      summary: page.summary,
      total: page.total,
      hasNextPage: page.hasNextPage,
      loadError: null as string | null,
      capabilities,
      pagination:
        page.total > 0 && (model.query.offset > 0 || page.hasNextPage)
          ? {
              offset: model.query.offset,
              limit: model.query.limit,
              countOnPage: rows.length,
              total: page.total,
              prevHref:
                model.query.offset > 0
                  ? model.buildPaginationHref({
                      offset: Math.max(0, model.query.offset - model.query.limit),
                    })
                  : null,
              nextHref: page.hasNextPage
                ? model.buildPaginationHref({
                    offset: model.query.offset + model.query.limit,
                  })
                : null,
            }
          : null,
    };
  } catch (error) {
    return {
      model,
      rows: [] as AdminAmlTableRow[],
      selected: null as AdminAmlTableRow | null,
      summary: EMPTY_ADMIN_AML_LIST_SUMMARY,
      total: 0,
      hasNextPage: false,
      loadError: error instanceof Error ? error.message : "Could not load AML screenings.",
      capabilities,
      pagination: null,
    };
  }
}
