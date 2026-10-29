import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { SellerProfileUnavailableAlert } from "@/components/dashboard/seller-profile-unavailable-alert";
import { SellingSectionTabs } from "@/components/dashboard/seller/selling-section-tabs";
import { SoldAndPayoutsView } from "@/components/dashboard/seller/sold-and-payouts-view";
import { ExportButton } from "@/components/exports/export-button";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { loadSoldAndPayouts } from "@/lib/seller/sold-and-payouts.server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sold & payouts" };

export default async function SellerPayoutsPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: DASHBOARD_ROUTES.sellerPayouts,
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  // Payouts settle the whole organisation's sales, so consignors and viewers do not see them.
  const refusal = workspacePageRefusal(DASHBOARD_ROUTES.sellerPayouts, sellerCtx.actor);
  if (refusal) {
    return (
      <>
        <SetMobileShellTitle title={refusal.label} />
        <WorkspacePageNoAccess
          label={refusal.label}
          openedBy={refusal.openedBy}
          next={DASHBOARD_ROUTES.sellerPayouts}
        />
      </>
    );
  }
  const { sellerEntityId, sellingAsOrganisation } = sellerCtx;
  const vm = sellerEntityId ? await loadSoldAndPayouts(sellerEntityId) : null;

  const exportAction =
    vm && vm.payouts.length > 0 && sellerEntityId ? (
      <ExportButton
        entityType="payouts"
        label="Export payouts"
        filters={{ legalEntityId: sellerEntityId }}
      />
    ) : null;
  const banner = !sellerEntityId ? <SellerProfileUnavailableAlert /> : null;

  return sellingAsOrganisation ? (
    <DashboardListPage
      title="Sold & payouts"
      description="Works that sold, and each payout with its statement."
      actions={exportAction}
      banner={banner}
    >
      {sellerEntityId ? <SoldAndPayoutsView vm={vm} /> : null}
    </DashboardListPage>
  ) : (
    <DashboardListPage
      title="Selling"
      description="Works you've offered to LAX, from specialist review to payout."
      actions={exportAction}
      banner={banner}
      tabs={<SellingSectionTabs current="payouts" />}
    >
      {sellerEntityId ? <SoldAndPayoutsView vm={vm} /> : null}
    </DashboardListPage>
  );
}
