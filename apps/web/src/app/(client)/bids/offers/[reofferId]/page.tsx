import { ReofferOfferView } from "@/components/dashboard/bids/offers/reoffer-offer-view";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { AccountRestoreHop } from "@/components/layout/account-switcher/account-restore-hop";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { buyingPageView } from "@/lib/buying/buying-pages";
import { getServerDataContainer } from "@/lib/data/container.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { openRecordInItsAccount } from "@/lib/legal-entity/open-record-in-account.server";
import { workspacePageOpenedBy } from "@/lib/presenters/workspace-access/workspace-access";
import { REOFFER_LATE_PARAM, bidderReofferHref } from "@/lib/reoffer/bidder-reoffer-links";
import { loadBidderReoffer } from "@/lib/reoffer/bidder-reoffer.server";
import { bidderReofferVm } from "@/lib/reoffer/bidder-reoffer.vm";
import { roleNeedsPersonalIdentity } from "@auction/domain";
import { reofferIdParamSchema } from "@auction/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "An offer for you" };

type PageProps = {
  params: Promise<{ reofferId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * One offer to buy a lot at the account's own bid after the winning bidder did not pay, and where
 * it stands. The API answers only for the acting account's own offers: another of the person's
 * accounts opens through the account switch, anyone else's is not found, and a role that does not
 * follow bids is told so. Nothing on this page accepts by itself: only the signed-in answer does.
 */
export default async function BidderReofferPage({ params, searchParams }: PageProps) {
  const { reofferId } = await params;
  const path = bidderReofferHref(reofferId);
  await requireAuthenticatedUser({ shell: "client", loginNext: path });
  if (!reofferIdParamSchema.safeParse({ reofferId }).success) notFound();

  const container = await getServerDataContainer();
  const scope = await container.buying.scope();
  const access = buyingPageView(scope, "bids");
  if (access.kind === "forbidden") {
    return (
      <>
        <SetMobileShellTitle title="Your offer" />
        <WorkspacePageNoAccess
          label="this offer"
          openedBy={workspacePageOpenedBy(["entity.bid.place"])}
          next={path}
        />
      </>
    );
  }

  const load = await loadBidderReoffer(reofferId);
  if (load.kind === "not_found") {
    // An offer made to another of the person's accounts opens in that account.
    const opened = await openRecordInItsAccount({
      kind: "reoffer",
      id: reofferId,
      actingId: scope.account.id,
      next: path,
    });
    if (opened.kind === "hop") return <AccountRestoreHop href={opened.href} />;
    notFound();
  }
  if (load.kind === "forbidden") {
    return (
      <>
        <SetMobileShellTitle title="Your offer" />
        <WorkspacePageNoAccess
          label="this offer"
          openedBy={workspacePageOpenedBy(["entity.bid.place"])}
          next={path}
        />
      </>
    );
  }
  if (load.kind === "error") {
    return (
      <DashboardPage>
        <SetMobileShellTitle title="Your offer" />
        <AccountLoadError
          headingLevel="h1"
          title="We couldn't load this offer"
          description="That's on our side, and nothing was changed. Try again in a moment."
        />
      </DashboardPage>
    );
  }

  const identityMatters =
    scope.account.kind === "personal" || roleNeedsPersonalIdentity(scope.account.actor.role);
  const [kyc, saleTitles, query] = await Promise.all([
    identityMatters ? container.kyc.getSummary().catch(() => null) : Promise.resolve(null),
    resolveSaleTitles([load.view.saleId]),
    searchParams,
  ]);
  const vm = bidderReofferVm(
    load.view,
    {
      canAnswer: access.offersSales,
      organisation: scope.account.kind === "organisation" ? scope.account.name : null,
      identityCheckPending: kyc?.requiresKyc === true,
      endedWhileAnswering: query[REOFFER_LATE_PARAM] !== undefined,
      saleTitle: load.view.saleId ? (saleTitles[load.view.saleId] ?? null) : null,
    },
    new Date(),
  );
  return (
    <DashboardPage>
      <SetMobileShellTitle title="Your offer" />
      <ReofferOfferView vm={vm} />
    </DashboardPage>
  );
}
