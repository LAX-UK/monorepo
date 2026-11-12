import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { SellerReofferView } from "@/components/dashboard/seller/seller-reoffer-view";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { workspacePageOpenedBy } from "@/lib/presenters/workspace-access/workspace-access";
import { sellerReofferHref } from "@/lib/seller/seller-reoffer-links";
import { loadSellerReoffer } from "@/lib/seller/seller-reoffer.server";
import { sellerReofferVm } from "@/lib/seller/seller-reoffer.vm";
import { sellingAccess } from "@/lib/seller/selling-access.server";
import { reofferIdParamSchema } from "@auction/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Offer to the next bidder" };

type PageProps = { params: Promise<{ reofferId: string }> };

/**
 * One request to sell the seller's lot at the next bidder's price after its buyer did not pay,
 * and where it stands. The API answers only for the acting account's own requests: another
 * account's is not found, and a role that cannot see requests is told so.
 */
export default async function SellerReofferPage({ params }: PageProps) {
  const { reofferId } = await params;
  const path = sellerReofferHref(reofferId);
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: path });
  if (!reofferIdParamSchema.safeParse({ reofferId }).success) notFound();

  const [load, sellerCtx] = await Promise.all([
    loadSellerReoffer(reofferId),
    resolveSellerWorkspaceContext(user.role, user.staffRoles),
  ]);
  if (load.kind === "not_found") notFound();
  if (load.kind === "forbidden") {
    return (
      <>
        <SetMobileShellTitle title="Offer request" />
        <WorkspacePageNoAccess
          label="this request"
          openedBy={workspacePageOpenedBy(["entity.consignments.read"])}
          next={path}
        />
      </>
    );
  }
  if (load.kind === "error") {
    return (
      <DashboardPage>
        <SetMobileShellTitle title="Offer request" />
        <AccountLoadError
          headingLevel="h1"
          title="We couldn't load this request"
          description="That's on our side, and nothing was changed. Try again in a moment."
        />
      </DashboardPage>
    );
  }

  const vm = sellerReofferVm(
    load.view,
    {
      canAnswer: sellerCan(sellerCtx, "entity.consignments.after_sale"),
      organisation: sellingAccess(sellerCtx).organisation,
    },
    new Date(),
  );
  return (
    <DashboardPage>
      <SetMobileShellTitle title={vm.lotTitle} />
      <SellerReofferView vm={vm} />
    </DashboardPage>
  );
}
