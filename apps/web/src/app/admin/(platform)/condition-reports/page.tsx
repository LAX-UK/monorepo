import { ConditionReportsStaffList } from "@/components/admin/condition-reports/condition-reports-staff-list";
import {
  conditionReportsAttention,
  conditionReportsEmpty,
  conditionReportsListHref,
  conditionReportsMetrics,
  conditionReportsRangeSummary,
  conditionReportsViews,
  toConditionReportStaffRows,
} from "@/lib/admin/condition-reports/condition-reports-staff-list.vm";
import { loadAdminConditionReportsListPage } from "@/lib/admin/load-condition-reports-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CONDITION_REPORTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Condition report requests",
  "Respond to buyer condition report requests.",
);

type Search = Record<string, string | undefined>;

export default async function AdminConditionReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  await requireAdminCapability(CONDITION_REPORTS_ACCESS, "/admin/condition-reports");

  const { model, rows, summary, total, loadError } = await loadAdminConditionReportsListPage(sp);
  const { query } = model;
  const listError = loadError ?? safeDecodeAdminErrorParam(sp.error);
  const hasNextPage = query.offset + rows.length < total;

  return (
    <ConditionReportsStaffList
      rows={toConditionReportStaffRows(rows)}
      search={sp}
      views={conditionReportsViews(sp, loadError ? null : summary)}
      activeLens={query.lens}
      attention={loadError ? [] : conditionReportsAttention(sp, summary)}
      metrics={loadError ? null : conditionReportsMetrics(summary)}
      empty={conditionReportsEmpty(query.lens)}
      pageSize={query.limit}
      pagination={
        !loadError && rows.length > 0
          ? {
              summary: conditionReportsRangeSummary(query.offset, rows.length, total),
              prevHref:
                query.offset > 0
                  ? conditionReportsListHref(sp, {
                      offset: Math.max(0, query.offset - query.limit),
                    })
                  : null,
              nextHref: hasNextPage
                ? conditionReportsListHref(sp, { offset: query.offset + query.limit })
                : null,
            }
          : null
      }
      listError={listError}
    />
  );
}
