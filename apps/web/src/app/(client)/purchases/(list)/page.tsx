import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { PurchasesView } from "@/components/dashboard/purchases/purchases-view";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { buyingPageView } from "@/lib/buying/buying-pages";
import { parsePortfolioParams } from "@/lib/dashboard/filters/portfolio/portfolio-filters";
import { getServerDataContainer } from "@/lib/data/container.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { parsePurchaseTab } from "@/lib/purchases/purchase-progress";
import { loadPurchaseSources } from "@/lib/purchases/purchase-sources.server";
import { buildPurchasesVm } from "@/lib/purchases/purchases.vm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Purchases" };

type PageProps = {
  searchParams: Promise<{ tab?: string; q?: string; payment?: string; year?: string }>;
};

export default async function DashboardPurchasesPage({ searchParams }: PageProps) {
  const scope = await (await getServerDataContainer()).buying.scope();
  const view = buyingPageView(scope, "purchases");
  if (view.kind === "forbidden") {
    return (
      <>
        <SetMobileShellTitle title={view.label} />
        <WorkspacePageNoAccess
          label={view.label}
          openedBy={view.openedBy}
          next={CLIENT_ROUTES.purchases}
        />
      </>
    );
  }
  const [sources, sp] = await Promise.all([loadPurchaseSources(), searchParams]);
  const filters = parsePortfolioParams(sp);
  return (
    <DashboardListPage title={view.title} description={view.description}>
      <SetMobileShellTitle title={view.title} />
      <PurchasesView
        filters={filters}
        offersSales={view.offersSales}
        vm={sources ? buildPurchasesVm(sources, parsePurchaseTab(sp.tab), filters) : null}
      />
    </DashboardListPage>
  );
}
