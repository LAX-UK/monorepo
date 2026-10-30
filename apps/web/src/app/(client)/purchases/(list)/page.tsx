import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { PortfolioNoticeToast } from "@/components/dashboard/portfolio-notice-toast";
import { PurchasesExportButton } from "@/components/dashboard/purchases/purchases-export-button";
import { PurchasesView } from "@/components/dashboard/purchases/purchases-view";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { buyingPageView } from "@/lib/buying/buying-pages";
import { getServerDataContainer } from "@/lib/data/container.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { PURCHASE_TABS, defaultPurchaseTab } from "@/lib/purchases/purchase-progress";
import { loadPurchaseSources } from "@/lib/purchases/purchase-sources.server";
import { parsePurchasesListQuery } from "@/lib/purchases/purchases-list";
import { buildPurchasesVm } from "@/lib/purchases/purchases.vm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Purchases" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const vm = sources ? buildPurchasesVm(sources) : null;
  const fallbackView = vm
    ? defaultPurchaseTab(
        Object.fromEntries(PURCHASE_TABS.map((tab) => [tab, vm.cardsByTab[tab].length])) as Record<
          (typeof PURCHASE_TABS)[number],
          number
        >,
      )
    : "to-pay";
  const organisation = scope.account.kind === "organisation" ? scope.account.name : null;
  return (
    <DashboardListPage
      title={view.title}
      description={view.description}
      actions={
        vm && vm.total > 0 ? <PurchasesExportButton vm={vm} fallbackView={fallbackView} /> : null
      }
    >
      <SetMobileShellTitle title={view.title} />
      <PortfolioNoticeToast />
      <PurchasesView
        vm={vm}
        query={parsePurchasesListQuery(sp, fallbackView)}
        organisation={organisation}
        offersSales={view.offersSales}
      />
    </DashboardListPage>
  );
}
