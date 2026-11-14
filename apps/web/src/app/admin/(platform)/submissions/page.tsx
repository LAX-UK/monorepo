import { AdminFlashNotice } from "@/components/admin/staff/admin-flash-notice";
import { SubmissionsStaffList } from "@/components/admin/submissions/submissions-staff-list";
import { categoryPickerOptions } from "@/lib/admin/catalog/category-picker-options";
import { loadAdminSubmissionsListPage } from "@/lib/admin/submissions/load-submissions-list-page";
import {
  type SubmissionsListSearch,
  submissionPanelRedirect,
  submissionsAttention,
  submissionsFilterChips,
  submissionsListHref,
  submissionsMetrics,
  submissionsRangeSummary,
  submissionsViews,
  toSubmissionsStaffRows,
} from "@/lib/admin/submissions/submissions-staff-list.vm";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SUBMISSIONS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Submissions",
  "Review seller submissions and staff decisions.",
);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSubmissionsPage({
  searchParams,
}: { searchParams: Promise<SubmissionsListSearch> }) {
  const user = await requireAdminCapability(SUBMISSIONS_READ_ACCESS, "/admin/submissions");
  const sp = await searchParams;
  // The submission panel is gone: an old shared `?submission=` (or `?preview=`) link opens the
  // submission's review page.
  const panelRedirect = submissionPanelRedirect(sp);
  if (panelRedirect) redirect(panelRedirect);
  const vm = await loadAdminSubmissionsListPage({
    sp: Object.fromEntries(Object.entries(sp).map(([key, value]) => [key, first(value)])),
    currentUserId: user.id,
  });
  const { model, summary, submissionRows, agreementsBySubmissionId, total } = vm;
  const { query } = model;

  return (
    <SubmissionsStaffList
      rows={toSubmissionsStaffRows(submissionRows, agreementsBySubmissionId)}
      search={sp}
      views={submissionsViews(sp, vm.loadError ? null : summary)}
      activeQueue={model.activeQueue}
      attention={vm.loadError ? [] : submissionsAttention(sp, summary)}
      metrics={vm.loadError ? [] : submissionsMetrics(summary)}
      filterChips={submissionsFilterChips(vm.activeFilterChips)}
      categories={categoryPickerOptions(vm.categories)}
      pageSize={query.limit}
      pagination={
        submissionRows.length > 0
          ? {
              summary: submissionsRangeSummary(query.offset, submissionRows.length, total),
              prevHref:
                query.offset > 0
                  ? submissionsListHref(sp, { offset: Math.max(0, query.offset - query.limit) })
                  : null,
              nextHref:
                query.offset + submissionRows.length < total
                  ? submissionsListHref(sp, { offset: query.offset + query.limit })
                  : null,
            }
          : null
      }
      currentUserId={user.id}
      exportFilters={model.exportFilters}
      listError={vm.loadError}
      notice={<AdminFlashNotice path="/admin/submissions" />}
      filtered={Boolean(
        model.initialQ.trim() || query.categoryId || query.qualityGaps || query.assignedToMe,
      )}
    />
  );
}
