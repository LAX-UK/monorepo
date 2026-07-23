import "server-only";

import {
  type SofListSearchParams,
  buildSofListPageModel,
} from "@/lib/admin/compliance/build-sof-list-page-model";
import type { SessionUser } from "@/lib/data/contracts";
import { getAdminSourceOfFundsPage } from "@/lib/data/http/compliance-sof.reader";
import { EMPTY_ADMIN_SOF_LIST_SUMMARY } from "@/lib/data/http/compliance-sof.shared";
import {
  type AdminSofTableRow,
  buildAdminSofTableRows,
} from "@/lib/data/view-models/admin-sof-table.vm";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

export async function loadAdminSofListPage(sp: SofListSearchParams, user: SessionUser) {
  const model = buildSofListPageModel(sp);
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const capabilities = {
    canReopen: userHasAccessTo(role, staffRole, MLRO_DECISION_ACCESS),
    canTriage: userHasAccessTo(role, staffRole, AML_REVIEW_ACCESS),
    canDecide: userHasAccessTo(role, staffRole, MLRO_DECISION_ACCESS),
  };

  try {
    const page = await getAdminSourceOfFundsPage(model.listQueryParams);
    const rows: AdminSofTableRow[] = buildAdminSofTableRows(page.rows);
    return {
      model,
      rows,
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
      rows: [] as AdminSofTableRow[],
      summary: EMPTY_ADMIN_SOF_LIST_SUMMARY,
      total: 0,
      hasNextPage: false,
      loadError: error instanceof Error ? error.message : "Could not load Source of Funds cases.",
      capabilities,
      pagination: null,
    };
  }
}
