/** Thin skeleton for organisation onboarding wizard shell. */
export function OrgOnboardingLoadingSkeleton() {
  return (
    <div
      className="container mx-auto max-w-3xl space-y-6 px-4 py-10"
      aria-busy="true"
      aria-label="Loading onboarding"
    >
      <div className="h-4 w-full max-w-md animate-pulse rounded bg-surface-container-high" />
      <div className="space-y-3 rounded-lg border border-border-hairline p-6">
        <div className="h-6 w-40 animate-pulse rounded bg-surface-container-high" />
        <div className="h-10 w-full animate-pulse rounded bg-surface-container-high" />
        <div className="h-10 w-full animate-pulse rounded bg-surface-container-high" />
        <div className="h-10 w-2/3 animate-pulse rounded bg-surface-container-high" />
      </div>
    </div>
  );
}
