import { DisputesStaffList } from "@/components/admin/disputes/disputes-staff-list";
import type { DisputesListSearch } from "@/lib/admin/finance/disputes-staff-list.vm";
import { loadAdminDisputesListPage } from "@/lib/admin/finance/load-disputes-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Disputes",
  "Stripe chargebacks and disputes with payment context and case timeline.",
);

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<DisputesListSearch>;
}) {
  const page = await loadAdminDisputesListPage(await searchParams);

  return (
    <DisputesStaffList
      search={page.search}
      view={page.view}
      rows={page.rows}
      summary={page.summary}
      pageSize={page.pageSize}
      pagination={page.pagination}
      loadError={page.loadError}
    />
  );
}
