import { SofStaffList } from "@/components/admin/compliance/sof-staff-list";
import type { SofListSearchParams } from "@/lib/admin/compliance/build-sof-list-page-model";
import { loadAdminSofListPage } from "@/lib/admin/compliance/load-sof-list-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { AML_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Source of funds",
  "Review buyer source of funds cases that block settlement until an MLRO approves them.",
);

const LIST_PATH = "/admin/compliance/source-of-funds";

export default async function AdminComplianceSourceOfFundsPage({
  searchParams,
}: {
  searchParams: Promise<SofListSearchParams>;
}) {
  const sp = await searchParams;
  const caseId = sp.case?.trim();
  if (caseId) {
    redirect(`${LIST_PATH}/${encodeURIComponent(caseId)}`);
  }

  const user = await requireAdminCapability(AML_REVIEW_ACCESS, LIST_PATH);
  const page = await loadAdminSofListPage(sp, user);

  return (
    <SofStaffList
      search={page.search}
      status={page.status}
      rows={page.rows}
      summary={page.summary}
      canReopen={page.capabilities.canReopen}
      attentionCounts={page.attentionCounts}
      pendingCount={page.pendingCount}
      pageSize={page.pageSize}
      pagination={page.pagination}
      loadError={page.loadError}
    />
  );
}
