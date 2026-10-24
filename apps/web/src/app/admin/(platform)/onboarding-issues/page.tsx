import { OnboardingIssuesStaffList } from "@/components/admin/onboarding/onboarding-issues-staff-list";
import type { OnboardingIssuesListSearchParams } from "@/lib/admin/build-onboarding-issues-list-page-model";
import { loadAdminOnboardingIssuesListPage } from "@/lib/admin/load-onboarding-issues-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Onboarding issues",
  "Legal entities, artists, KYC sessions and documents awaiting staff review.",
);

export default async function AdminOnboardingIssuesPage({
  searchParams,
}: {
  searchParams: Promise<OnboardingIssuesListSearchParams>;
}) {
  const page = await loadAdminOnboardingIssuesListPage(await searchParams);

  return (
    <OnboardingIssuesStaffList
      search={page.search}
      tab={page.tab}
      rows={page.rows}
      selected={page.selected}
      selectedId={page.selectedId}
      previewDegraded={page.previewDegraded}
      queueSummary={page.queueSummary}
      lensSummary={page.lensSummary}
      offset={page.offset}
      total={page.total}
      pageSize={page.pageSize}
      pagination={page.pagination}
      loadError={page.loadError}
    />
  );
}
