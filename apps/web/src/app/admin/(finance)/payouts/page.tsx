import { PayoutsStaffList } from "@/components/admin/payouts/payouts-staff-list";
import { loadAdminPayoutsListPage } from "@/lib/admin/finance/load-payouts-list-page";
import type { PayoutsListSearch } from "@/lib/admin/finance/payouts-staff-list.vm";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Payouts",
  "Run seller settlements, review payout totals, and reconcile Stripe transfers.",
);

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<PayoutsListSearch>;
}) {
  const sp = await searchParams;

  if (sp.settlement === "1") {
    redirect("/admin/payouts/settlement");
  }

  const page = await loadAdminPayoutsListPage(sp);

  return (
    <PayoutsStaffList
      search={page.search}
      view={page.view}
      rows={page.rows}
      summary={page.summary}
      disputesOpen={page.disputesOpen}
      capabilities={page.capabilities}
      sellerFilterName={page.sellerFilterName}
      exportFilters={page.exportFilters}
      pageSize={page.pageSize}
      pagination={page.pagination}
      loadError={page.loadError}
    />
  );
}
