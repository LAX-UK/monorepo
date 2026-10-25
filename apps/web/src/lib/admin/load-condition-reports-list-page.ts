import "server-only";

import {
  type ConditionReportsListSearchParams,
  buildConditionReportsListPageModel,
} from "@/lib/admin/build-condition-reports-list-page-model";
import { getAdminConditionReportsPage } from "@/lib/data/http/admin-condition-reports.reader";
import { EMPTY_ADMIN_CONDITION_REPORT_LIST_SUMMARY } from "@/lib/data/http/admin-condition-reports.shared";

export async function loadAdminConditionReportsListPage(sp: ConditionReportsListSearchParams) {
  const model = buildConditionReportsListPageModel(sp);

  try {
    const page = await getAdminConditionReportsPage(model.listQueryParams);
    return {
      model,
      rows: page.rows,
      summary: page.summary,
      total: page.total,
      loadError: null as string | null,
    };
  } catch (error) {
    return {
      model,
      rows: [],
      summary: EMPTY_ADMIN_CONDITION_REPORT_LIST_SUMMARY,
      total: 0,
      loadError: error instanceof Error ? error.message : "Could not load condition reports.",
    };
  }
}
