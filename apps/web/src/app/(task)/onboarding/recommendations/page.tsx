import { BuyerRecommendationsViewTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import {
  BuyerOnboardingShell,
  onboardingActions,
} from "@/components/onboarding/buyer-onboarding-shell";
import { RecommendationWatchlistButton } from "@/components/onboarding/recommendation-watchlist-button";
import { RecommendationsContinueLink } from "@/components/onboarding/recommendations-continue-link";
import { toLotCardVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerCategoryInterests } from "@/lib/data/http/category-interests.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { isFullBuyerOnboardingEnabled } from "@/lib/kyc/full-buyer-onboarding-rollout.server";
import {
  identityOnboardingHref,
  resolveIdentityOnboardingNext,
} from "@/lib/kyc/identity-onboarding";
import { BUYER_INTERESTS } from "@/lib/onboarding/buyer-interest-manifest";
import {
  recommendationCategoryIds,
  uniqueRecommendationRows,
} from "@/lib/onboarding/buyer-recommendations";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function BuyerRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; source?: string }>;
}) {
  const params = await searchParams;
  const next = resolveIdentityOnboardingNext(params.next);
  const source = params.source === "sign_in_resume" ? "sign_in_resume" : "post_verify";
  const identityHref = identityOnboardingHref("why", next, source);
  if (!isFullBuyerOnboardingEnabled()) redirect(identityHref);
  const [categoryReader, interestState, lotReader, watchedIds] = await Promise.all([
    getServerCategoryReader(),
    getServerCategoryInterests(),
    getServerLotReader(),
    getServerWatchedLotIdSet(),
  ]);
  const categories = await categoryReader.list();
  const excludedSlug = BUYER_INTERESTS.find(
    (interest) => interest.key === "something-else",
  )?.categorySlug;
  const categoryIds = recommendationCategoryIds(
    interestState.categoryIds,
    categories,
    new Set(excludedSlug ? [excludedSlug] : []),
  );
  const rows = uniqueRecommendationRows(
    await Promise.all(
      categoryIds.map((categoryId) =>
        lotReader.list({ categoryId, status: "active", sort: "endingAsc", limit: 3 }),
      ),
    ).then((categoryRows) => categoryRows.flat()),
  );
  if (rows.length === 0) redirect(identityHref);
  const lots = rows.map(toLotCardVM);
  const firstLot = lots[0];
  if (!firstLot) redirect(identityHref);
  const contextualIdentityHref = `${identityHref}&lot=${encodeURIComponent(firstLot.id)}`;

  return (
    <BuyerOnboardingShell
      title="Recommended lots"
      description={
        <>
          Explore the latest works, save the pieces you love, and
          <br className="hidden sm:block" /> find your next addition to the collection.
        </>
      }
      progress={2}
      backHref={`/onboarding/interests?${new URLSearchParams({ next, source }).toString()}`}
    >
      <BuyerRecommendationsViewTracker source={source} />
      <div className="grid w-full gap-6 sm:grid-cols-3">
        {lots.map((lot, index) => (
          <article key={lot.id} className="flex min-w-0 flex-col gap-4">
            <Link
              href={lot.href}
              className="group rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
            >
              <div className="relative aspect-[1.03] overflow-hidden bg-ink shadow-sm sm:h-[clamp(180px,30vh,300px)] sm:aspect-auto">
                <MediaImage
                  src={lot.imageUrl}
                  alt={lot.imageAlt}
                  label="Lot artwork"
                  sizes="(min-width: 1024px) 317px, (min-width: 640px) 31vw, 92vw"
                  className="h-full"
                  imgClassName="transition-[opacity,transform] duration-500 motion-reduce:transition-none group-hover:scale-[1.025]"
                  priority={index === 0}
                  tone="dark"
                />
                <span className="absolute left-3 top-3 rounded bg-secondary/90 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-on-secondary">
                  {lot.lotLabel}
                </span>
              </div>
              <h2 className="mt-3 truncate text-xl font-medium leading-6 text-on-surface">
                {lot.title}
              </h2>
              <p className="mt-1 truncate text-sm font-light leading-4 text-on-surface-variant">
                {lot.artistName}
              </p>
            </Link>
            <RecommendationWatchlistButton
              lotId={lot.id}
              lotTitle={lot.title}
              initialWatching={watchedIds.has(lot.id)}
              loginNextPath={`/onboarding/recommendations?${new URLSearchParams({ next, source }).toString()}`}
            />
          </article>
        ))}
      </div>
      <div className={onboardingActions}>
        <RecommendationsContinueLink href={contextualIdentityHref} source={source} />
      </div>
    </BuyerOnboardingShell>
  );
}
