import { PayoutsStaffList } from "@/components/admin/payouts/payouts-staff-list";
import {
  HeldSalesList,
  OldRuleList,
} from "@/components/admin/seller-proceeds/payouts-special-views";
import { loadAdminPayoutsListPage } from "@/lib/admin/finance/load-payouts-list-page";
import {
  type PayoutsListSearch,
  activePayoutsView,
} from "@/lib/admin/finance/payouts-staff-list.vm";
import {
  loadHeldSalesView,
  loadOldRuleView,
  loadPayoutSales,
} from "@/lib/admin/seller-proceeds/load-payouts-special-views";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Payouts",
  "Run seller settlements, review payout totals, and reconcile Stripe transfers.",
);

/** The search params as plain strings, so the client can build view links. */
function plainSearch(sp: PayoutsListSearch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<PayoutsListSearch>;
}) {
  const sp = await searchParams;

  if (sp.settlement === "1") {
    redirect("/admin/payouts/settlement");
  }

  const view = activePayoutsView(sp);
  if (view === "held") {
    const held = await loadHeldSalesView();
    return <HeldSalesList search={plainSearch(sp)} {...held} />;
  }
  if (view === "old_rule") {
    const old = await loadOldRuleView(sp);
    return <OldRuleList search={plainSearch(sp)} {...old} />;
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
      loadSales={loadPayoutSales}
    />
  );
}
