import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { SellerProfileUnavailableAlert } from "@/components/dashboard/seller-profile-unavailable-alert";
import { SoldAndPayoutsView } from "@/components/dashboard/seller/sold-and-payouts-view";
import { SoldExportButton } from "@/components/dashboard/seller/sold-export-button";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { sellingAccess } from "@/lib/seller/selling-access.server";
import { parseSoldListQuery, soldInView, soldRecord } from "@/lib/seller/sold-and-payouts-list";
import { loadSoldAndPayouts } from "@/lib/seller/sold-and-payouts.server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sold & payouts" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Sold & payouts: works that sold and where each one's money stands, and the payouts with their
 * statements. Payouts settle the whole account's sales, so consignors and viewers do not see them.
 */
export default async function SellerPayoutsPage({ searchParams }: PageProps) {
  const path = DASHBOARD_ROUTES.sellerPayouts;
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: path });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  const refusal = workspacePageRefusal(path, sellerCtx.actor);
  if (refusal) {
    return (
      <>
        <SetMobileShellTitle title={refusal.label} />
        <WorkspacePageNoAccess label={refusal.label} openedBy={refusal.openedBy} next={path} />
      </>
    );
  }
  const { sellerEntityId, sellingAsOrganisation } = sellerCtx;
  const { organisation } = sellingAccess(sellerCtx);
  const [vm, sp] = await Promise.all([
    sellerEntityId ? loadSoldAndPayouts(sellerEntityId) : Promise.resolve(null),
    searchParams,
  ]);
  const query = parseSoldListQuery(sp);
  const now = new Date();
  const records = vm?.sold?.map((lot) => soldRecord(lot, now)) ?? [];
  const hasAny = Boolean(vm && (records.length > 0 || vm.payouts.length > 0));
  const setup = sellerCan(sellerCtx, "entity.connect.operate")
    ? {
        href:
          sellingAsOrganisation && sellerEntityId
            ? organisationHref("payouts")
            : DASHBOARD_ROUTES.sellerConnect,
      }
    : null;

  return (
    <DashboardListPage
      title="Sold & payouts"
      description={
        organisation
          ? `Works that sold for ${organisation}, and the money on its way.`
          : "Works you sold, and the money on its way."
      }
      banner={sellerEntityId ? null : <SellerProfileUnavailableAlert />}
      actions={
        hasAny && vm ? (
          <SoldExportButton
            counts={{
              sold: soldInView(records, { ...query, q: "" }).length,
              payouts: vm.payouts.length,
            }}
          />
        ) : null
      }
    >
      <SetMobileShellTitle title="Sold & payouts" />
      {sellerEntityId ? (
        <SoldAndPayoutsView vm={vm} query={query} organisation={organisation} setup={setup} />
      ) : null}
    </DashboardListPage>
  );
}
