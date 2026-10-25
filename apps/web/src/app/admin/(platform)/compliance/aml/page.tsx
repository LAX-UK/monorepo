import { AmlStaffList } from "@/components/admin/compliance/aml-staff-list";
import type { AmlListSearchParams } from "@/lib/admin/compliance/build-aml-list-page-model";
import { loadAdminAmlListPage } from "@/lib/admin/compliance/load-aml-list-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { AML_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "AML screening",
  "Review watchlist matches before settlement holds are lifted.",
);

export default async function AdminComplianceAmlPage({
  searchParams,
}: {
  searchParams: Promise<AmlListSearchParams>;
}) {
  const sp = await searchParams;
  const user = await requireAdminCapability(AML_REVIEW_ACCESS, "/admin/compliance/aml");
  const page = await loadAdminAmlListPage(sp, user);

  return (
    <AmlStaffList
      search={page.search}
      rows={page.rows}
      selected={page.selected}
      selectedId={page.selectedId}
      summary={page.summary}
      capabilities={page.capabilities}
      attentionCounts={page.attentionCounts}
      pageSize={page.pageSize}
      pagination={page.pagination}
      loadError={page.loadError}
    />
  );
}
