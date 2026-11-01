import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";

export default function ResultsLoading() {
  return (
    <MarketingCatalogHubShell
      aria-busy="true"
      aria-label="Loading results"
      hero={
        <div className="animate-pulse space-y-4">
          <div className="h-14 w-2/3 max-w-md rounded bg-surface-container-high" />
          <div className="h-4 w-48 rounded bg-surface-container-high" />
        </div>
      }
    >
      <ul className="flex flex-col gap-4">
        {[0, 1, 2].map((key) => (
          <li
            key={key}
            className="h-40 animate-pulse rounded-lax-card border border-lax-line bg-surface-container-low"
          />
        ))}
      </ul>
    </MarketingCatalogHubShell>
  );
}
