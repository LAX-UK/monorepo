import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { archiveClearFiltersHref } from "@/lib/archive/build-archive-params";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";

export type { ArchiveLotVM } from "./catalog-archive-views";

/** Empty state when no archive rows match filters. */
export function PastAuctionsEmpty({ hasActiveFilters = false }: { hasActiveFilters?: boolean }) {
  const clearHref = archiveClearFiltersHref();

  return (
    <MarketingEmptyState
      variant="marketing"
      context={hasActiveFilters ? "filtered" : "noResults"}
      title={
        hasActiveFilters ? "No past auctions match these filters." : "No past auction results yet."
      }
      description={
        hasActiveFilters
          ? "Try adjusting filters or browse the full catalogue."
          : "Check back after upcoming sales close, or browse live and upcoming lots."
      }
      action={
        hasActiveFilters ? (
          <>
            <ButtonLink Link={Link} variant="primary" href={clearHref}>
              Clear filters
            </ButtonLink>
            <ButtonLink Link={Link} variant="secondary" href="/search">
              Browse all lots
            </ButtonLink>
          </>
        ) : (
          <>
            <ButtonLink Link={Link} variant="primary" href="/search">
              Browse all lots
            </ButtonLink>
            <ButtonLink Link={Link} variant="secondary" href="/sales">
              View upcoming sales
            </ButtonLink>
          </>
        )
      }
    />
  );
}
