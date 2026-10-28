import { MyBidsView } from "@/components/dashboard/bids/my-bids-view";
import { KycVerificationBanner } from "@/components/dashboard/kyc-verification-banner";
import { parseMyBidTab } from "@/lib/bid/my-bid-status";
import { type MyBidsVm, buildMyBidsVm } from "@/lib/bid/my-bids.vm";
import { getServerDataContainer } from "@/lib/data/container.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { shouldOfferIdentityOnboarding } from "@/lib/kyc/identity-onboarding";
import { isIdentityOnboardingEnabled } from "@/lib/kyc/identity-onboarding-rollout.server";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

/** Loads bid data inside a parent `<Suspense>` so route `loading.tsx` can render. */
export async function BidsPageContent({ searchParams }: PageProps) {
  const tab = parseMyBidTab((await searchParams).tab);
  const container = await getServerDataContainer();
  const [userResult, bidsResult, kycResult] = await Promise.allSettled([
    container.session.getCurrent(),
    container.bids.listMine(),
    container.kyc.getSummary(),
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

  return (
    <>
      {kycSummary && (kycSummary.requiresKyc || proactiveKyc) ? (
        <KycVerificationBanner
          summary={kycSummary}
          proactive={proactiveKyc}
          onboardingEnabled={kycOnboardingEnabled}
        />
      ) : null}
      <MyBidsView vm={vm} userId={user?.id ?? null} />
    </>
  );
}
