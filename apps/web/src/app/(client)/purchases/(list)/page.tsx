import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { PurchasesView } from "@/components/dashboard/purchases/purchases-view";
import { parsePortfolioParams } from "@/lib/dashboard/filters/portfolio/portfolio-filters";
import { parsePurchaseTab } from "@/lib/purchases/purchase-progress";
import { loadPurchaseSources } from "@/lib/purchases/purchase-sources.server";
import { buildPurchasesVm } from "@/lib/purchases/purchases.vm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Purchases" };

type PageProps = {
  searchParams: Promise<{ tab?: string; q?: string; payment?: string; year?: string }>;
};

export default async function DashboardPurchasesPage({ searchParams }: PageProps) {
  const [sources, sp] = await Promise.all([loadPurchaseSources(), searchParams]);
  const filters = parsePortfolioParams(sp);
  return (
    <DashboardListPage title="Purchases" description="Lots you have won, from payment to delivery.">
      <PurchasesView
        filters={filters}
        vm={sources ? buildPurchasesVm(sources, parsePurchaseTab(sp.tab), filters) : null}
      />
    </DashboardListPage>
  );
}
