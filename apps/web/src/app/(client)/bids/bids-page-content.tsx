import { MyBidsMoreMenu } from "@/components/dashboard/bids/my-bids-more-menu";
import { BROWSE_UPCOMING_SALES_HREF, MyBidsView } from "@/components/dashboard/bids/my-bids-view";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { KycVerificationBanner } from "@/components/dashboard/kyc-verification-banner";
import { parseMyBidTab } from "@/lib/bid/my-bid-status";
import { type MyBidsVm, buildMyBidsVm } from "@/lib/bid/my-bids.vm";
import { DASHBOARD_CTA } from "@/lib/dashboard/dashboard-copy";
import { getServerDataContainer } from "@/lib/data/container.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { shouldOfferIdentityOnboarding } from "@/lib/kyc/identity-onboarding";
import { isIdentityOnboardingEnabled } from "@/lib/kyc/identity-onboarding-rollout.server";
import { roleNeedsPersonalIdentity } from "@auction/domain";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
  title: string;
  description: string;
  /** Sections under the bids (a person's telephone bids and condition reports). */
  children?: ReactNode;
};

/**
 * The Bids page once its data is in: the header, the identity notice and the bids. The header
 * offers the sales only when there are bids; with none, the empty state carries that one action.
 */
export async function BidsPageContent({ searchParams, title, description, children }: PageProps) {
  const tab = parseMyBidTab((await searchParams).tab);
  const container = await getServerDataContainer();
  const scope = await container.buying.scope();
  // Inside an organisation the person's own identity matters only for roles that bid in person.
  const identityMatters =
    scope.account.kind === "personal" || roleNeedsPersonalIdentity(scope.account.actor.role);
  const [userResult, bidsResult, kycResult] = await Promise.allSettled([
    container.session.getCurrent(),
    container.buying.bids(),
    identityMatters ? container.kyc.getSummary() : Promise.resolve(null),
  ]);
  const user = userResult.status === "fulfilled" ? userResult.value : null;

  let vm: MyBidsVm | null = null;
  if (bidsResult.status === "fulfilled") {
    const rows = bidsResult.value;
    vm = buildMyBidsVm({
      rows,
      userId: user?.id,
      tab,
      saleTitleById: await resolveSaleTitles(rows.map((row) => row.lot?.saleId)),
    });
  }

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

  const hasBids = vm ? vm.tabs.some((t) => t.count > 0) : false;
  return (
    <DashboardListPage
      title={title}
      description={description}
      actions={
        hasBids ? (
          <div className="flex gap-2 max-md:[&>a]:flex-1">
            <Button variant="secondaryOutline" size="default" asChild>
              <Link href={BROWSE_UPCOMING_SALES_HREF}>{DASHBOARD_CTA.browseUpcomingSales}</Link>
            </Button>
            <MyBidsMoreMenu />
          </div>
        ) : null
      }
    >
      {kycSummary && (kycSummary.requiresKyc || proactiveKyc) ? (
        <KycVerificationBanner
          summary={kycSummary}
          proactive={proactiveKyc}
          onboardingEnabled={kycOnboardingEnabled}
        />
      ) : null}
      <MyBidsView vm={vm} userId={user?.id ?? null} />
      {children}
    </DashboardListPage>
  );
}
