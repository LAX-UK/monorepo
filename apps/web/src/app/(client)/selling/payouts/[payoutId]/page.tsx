import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PayoutDetail } from "@/components/dashboard/seller/payout-detail";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { ListLoadError } from "@/components/workspace/list-states";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerPayoutDetail } from "@/lib/data/http/workspace-selling.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { payoutDetailVm } from "@/lib/seller/payout-detail.vm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Payout" };

type PageProps = { params: Promise<{ payoutId: string }> };

/**
 * One payout with its lines. The API answers only for the acting account's own payouts and the
 * members who see its money; another account's payout is not found.
 */
export default async function PayoutPage({ params }: PageProps) {
  const { payoutId } = await params;
  const path = `${CLIENT_ROUTES.payouts}/${payoutId}`;
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: path });
  const ctx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  const refusal = workspacePageRefusal(CLIENT_ROUTES.payouts, ctx.actor);
  if (refusal) {
    return (
      <>
        <SetMobileShellTitle title={refusal.label} />
        <WorkspacePageNoAccess label={refusal.label} openedBy={refusal.openedBy} next={path} />
      </>
    );
  }
  if (!ctx.sellerEntityId) notFound();
  const detail = await getServerPayoutDetail(payoutId).catch(() => undefined);
  if (detail === null) notFound();
  const vm = detail
    ? payoutDetailVm(detail, { sellerEntityId: ctx.sellerEntityId, now: new Date() })
    : null;
  return (
    <DashboardPage>
      <SetMobileShellTitle title={vm?.title ?? "Payout"} />
      {vm ? <PayoutDetail vm={vm} /> : <ListLoadError />}
    </DashboardPage>
  );
}
