import { BuyerOnboardingShell } from "@/components/onboarding/buyer-onboarding-shell";
import { Skeleton } from "@auction/ui/components/skeleton";

type BuyerOnboardingLoadingVariant = "interests" | "recommendations" | "identity";

type Props = {
  variant: BuyerOnboardingLoadingVariant;
};

const INTEREST_SKELETON_IDS = [
  "art",
  "watches",
  "jewellery",
  "coins",
  "sculpture",
  "antiques",
  "memorabilia",
  "other",
] as const;

const RECOMMENDATION_SKELETON_IDS = ["first", "second", "third"] as const;

function InterestsSkeleton() {
  return (
    <>
      <div className="grid w-full grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4" aria-hidden>
        {INTEREST_SKELETON_IDS.map((id) => (
          <div
            key={id}
            className="h-[190px] overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest sm:h-[clamp(170px,23vh,239px)]"
          >
            <Skeleton className="h-[calc(100%-62px)] rounded-none" />
            <div className="flex h-[62px] items-center justify-center">
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
      <ActionsSkeleton />
    </>
  );
}

function RecommendationsSkeleton() {
  return (
    <>
      <div className="grid w-full gap-6 sm:grid-cols-3" aria-hidden>
        {RECOMMENDATION_SKELETON_IDS.map((id) => (
          <div key={id} className="space-y-4">
            <Skeleton className="aspect-[1.03] w-full rounded-none sm:h-[clamp(180px,30vh,300px)] sm:aspect-auto" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
      <ActionsSkeleton />
    </>
  );
}

function IdentitySkeleton() {
  return (
    <>
      <div className="flex w-full flex-col items-center gap-3" aria-hidden>
        <Skeleton className="h-6 w-full max-w-md" />
        <Skeleton className="h-5 w-52" />
      </div>
      <div className="w-full max-w-2xl space-y-5 rounded-lg border border-primary/20 bg-primary-container/20 p-6">
        <Skeleton className="mx-auto h-4 w-28" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-12 w-full bg-surface-container-lowest" />
          <Skeleton className="h-12 w-full bg-surface-container-lowest" />
          <Skeleton className="h-12 w-full bg-surface-container-lowest" />
        </div>
      </div>
      <ActionsSkeleton />
    </>
  );
}

function ActionsSkeleton() {
  return (
    <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-14 w-full sm:w-40" />
      <Skeleton className="h-14 w-full sm:w-[140px]" />
    </div>
  );
}

export function BuyerOnboardingLoadingSkeleton({ variant }: Props) {
  const progress = variant === "interests" ? 1 : variant === "recommendations" ? 2 : 3;
  const content =
    variant === "interests" ? (
      <InterestsSkeleton />
    ) : variant === "recommendations" ? (
      <RecommendationsSkeleton />
    ) : (
      <IdentitySkeleton />
    );

  return (
    <div aria-busy="true" aria-label={`Loading ${variant} onboarding`}>
      <BuyerOnboardingShell
        title={
          <span
            className="block h-8 w-[min(68vw,520px)] animate-pulse rounded bg-surface-container-high sm:h-10"
            aria-hidden
          />
        }
        description={
          <span
            className="block h-5 w-[min(76vw,600px)] animate-pulse rounded bg-surface-container-high"
            aria-hidden
          />
        }
        progress={progress}
        width={variant === "identity" ? "identity" : "standard"}
      >
        {content}
      </BuyerOnboardingShell>
    </div>
  );
}
