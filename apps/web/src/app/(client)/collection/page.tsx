import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { CollectionView } from "@/components/dashboard/seller/collection-view";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import {
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { parseWorksListQuery } from "@/lib/seller/collection-works";
import { loadCollectionWorks } from "@/lib/seller/collection.server";
import { sellingAccess } from "@/lib/seller/selling-access.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

const PATH = CLIENT_ROUTES.collection;

export const metadata: Metadata = { title: "Works" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The organisation's collection through Bid: the works it owns, where each one is, and a way
 * to consign one. Payments live in Purchases; a person's own works are in LAX Account.
 */
export default async function CollectionPage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: PATH });
  const ctx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  if (!ctx.sellingAsOrganisation || !ctx.sellerEntityId) redirect(CLIENT_ROUTES.consignments);
  const refusal = workspacePageRefusal(PATH, ctx.actor);
  if (refusal) {
    return (
      <>
        <SetMobileShellTitle title={refusal.label} />
        <WorkspacePageNoAccess label={refusal.label} openedBy={refusal.openedBy} next={PATH} />
      </>
    );
  }
  const access = sellingAccess(ctx);
  const organisation = access.organisation ?? "Your organisation";
  const [works, sp] = await Promise.all([
    loadCollectionWorks({ organisationId: ctx.sellerEntityId, canSell: access.canSell }),
    searchParams,
  ]);

  return (
    <DashboardListPage
      title="Works"
      description={`Works ${organisation} owns through LAX Bid, and where each one is.`}
    >
      <SetMobileShellTitle title="Works" />
      <p className="text-lax-13 text-lax-muted">
        Your collection across LAX lives in{" "}
        <a
          href={laxAccountHomeUrl()}
          className="text-lax-fg underline underline-offset-4 lax-focus"
        >
          LAX Account
        </a>
        . This list shows what came through Bid.
      </p>
      <CollectionView
        works={works}
        query={parseWorksListQuery(sp)}
        organisation={organisation}
        showPrice={sellerCan(ctx, "entity.finance.read")}
        canBid={sellerCan(ctx, "entity.bid.place")}
        pausedReason={access.pausedReason}
      />
    </DashboardListPage>
  );
}
