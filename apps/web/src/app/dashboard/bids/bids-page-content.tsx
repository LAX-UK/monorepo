import { parseBidTab } from "@/components/dashboard/bid-board-rows";
import { BidsBoard } from "@/components/dashboard/bids-board";
import { KycVerificationBanner } from "@/components/dashboard/kyc-verification-banner";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { buildDashboardBidsBoardVm } from "@/lib/data/view-models/dashboard-bids.vm";
import { shouldOfferIdentityOnboarding } from "@/lib/kyc/identity-onboarding";
import { isIdentityOnboardingEnabled } from "@/lib/kyc/identity-onboarding-rollout.server";

type PageProps = {
  searchParams: Promise<{ tab?: string; q?: string }>;
};

/** Loads bid data inside a parent `<Suspense>` so route `loading.tsx` can render. */
export async function BidsPageContent({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initialTab = parseBidTab(sp.tab);
  const initialQ = (sp.q ?? "").trim().slice(0, 200);
  const now = Date.now();
  const container = await getServerDataContainer();
  let rows: Awaited<ReturnType<typeof container.bids.listMine>> = [];
  let loadFailure: DashboardSliceFailure | null = null;
  let sessionFailure: DashboardSliceFailure | null = null;
  let user: Awaited<ReturnType<typeof container.session.getCurrent>> = null;

  const settled = await Promise.allSettled([
    container.session.getCurrent(),
    container.bids.listMine(),
    container.kyc.getSummary(),
  ]);
  const [userResult, bidsResult, kycResult] = settled;
  if (userResult.status === "fulfilled") {
    user = userResult.value;
  } else {
    sessionFailure = describeDashboardSliceFailure(
      userResult.reason,
      "session",
      "Could not load your session.",
    );
  }
  if (bidsResult.status === "fulfilled") {
    rows = bidsResult.value;
  } else {
    rows = [];
    loadFailure = describeDashboardSliceFailure(bidsResult.reason, "bids", "Could not load bids.");
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

  const { active, won, lost } = buildDashboardBidsBoardVm(rows, user?.id, now);

  const artistIds = rows.map((r) => r.lot?.artistId ?? null);
  const artistNameById = await resolveArtistNames(artistIds);

  return (
    <>
      {kycSummary && (kycSummary.requiresKyc || proactiveKyc) ? (
        <div className="mb-6">
          <KycVerificationBanner
            summary={kycSummary}
            proactive={proactiveKyc}
            onboardingEnabled={kycOnboardingEnabled}
          />
        </div>
      ) : null}
      <BidsBoard
        loadFailure={loadFailure}
        sessionFailure={sessionFailure}
        active={active}
        won={won}
        lost={lost}
        initialTab={initialTab}
        initialQ={initialQ}
        artistNameById={artistNameById}
      />
    </>
  );
}
