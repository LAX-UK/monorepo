import { BidsExportButton } from "@/components/dashboard/bids/bids-export-button";
import { BidsView } from "@/components/dashboard/bids/bids-view";
import { BuyerAgentBanner } from "@/components/dashboard/bids/buyer-agent-banner";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { KycVerificationBanner } from "@/components/dashboard/kyc-verification-banner";
import { parseBidsListQuery } from "@/lib/bid/bids-list";
import { loadBidsPage } from "@/lib/bid/load-bids-page.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { shouldOfferIdentityOnboarding } from "@/lib/kyc/identity-onboarding";
import { isIdentityOnboardingEnabled } from "@/lib/kyc/identity-onboarding-rollout.server";
import { roleNeedsPersonalIdentity } from "@auction/domain";
import type { ReactNode } from "react";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  title: string;
  description: string;
  /** The member may bid, so an empty list points to the sales. */
  offersSales: boolean;
  /** Sections under the bids (a person's telephone bids and condition reports). */
  children?: ReactNode;
};

/**
 * The Bids page once its data is in: the header with Export, a buyer agent's authority, the
 * identity notice where it matters, and the views.
 */
export async function BidsPageContent({
  searchParams,
  title,
  description,
  offersSales,
  children,
}: PageProps) {
  const query = parseBidsListQuery(await searchParams);
  const container = await getServerDataContainer();
  const scope = await container.buying.scope();
  // Inside an organisation the person's own identity matters only for roles that bid in person.
  const identityMatters =
    scope.account.kind === "personal" || roleNeedsPersonalIdentity(scope.account.actor.role);
  const [userResult, kycResult] = await Promise.allSettled([
    container.session.getCurrent(),
    identityMatters ? container.kyc.getSummary() : Promise.resolve(null),
  ]);
  const user = userResult.status === "fulfilled" ? userResult.value : null;
  const page = await loadBidsPage(user);

  // Identity checks matter here, where bids are placed and tracked, so the notice sits on this
  // page instead of in an alert on every page. The bid panel and checkout raise their own.
  const kycSummary = kycResult.status === "fulfilled" ? kycResult.value : null;
  const kycOnboardingEnabled = isIdentityOnboardingEnabled();
  const proactiveKyc =
    !kycSummary?.requiresKyc &&
    shouldOfferIdentityOnboarding({
      enabled: kycOnboardingEnabled,
      summary: kycSummary,
      signupPersona: user?.signupPersona,
    });

  const hasBids = page.vm
    ? page.vm.cardsByTab.active.length +
        page.vm.cardsByTab.won.length +
        page.vm.cardsByTab.lost.length >
      0
    : false;
  return (
    <DashboardListPage
      title={title}
      description={description}
      actions={hasBids ? <BidsExportButton vm={page.vm} /> : null}
    >
      {/* One rhythm for the notices and the list: 24px, as between every block of a list page. */}
      <div className="flex flex-col gap-6">
        {page.agentBanner ? <BuyerAgentBanner banner={page.agentBanner} /> : null}
        {kycSummary && (kycSummary.requiresKyc || proactiveKyc) ? (
          <KycVerificationBanner
            summary={kycSummary}
            proactive={proactiveKyc}
            onboardingEnabled={kycOnboardingEnabled}
          />
        ) : null}
        <BidsView
          vm={page.vm}
          registrations={page.registrations}
          query={query}
          organisation={page.organisation}
          shared={page.shared}
          offersSales={offersSales}
          bidBlockedReason={page.bidBlockedReason}
          userId={page.userId}
        />
      </div>
      {children}
    </DashboardListPage>
  );
}
