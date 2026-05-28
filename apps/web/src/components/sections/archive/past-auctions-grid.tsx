import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { archiveClearFiltersHref } from "@/lib/archive/build-archive-params";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export type { ArchiveLotVM } from "./catalog-archive-views";

/** Empty state when no archive rows match filters. */
export function PastAuctionsEmpty({
  hasActiveFilters = false,
  layoutView = "grid",
}: {
  hasActiveFilters?: boolean;
  layoutView?: CatalogLayoutView;
}) {
  const clearHref = archiveClearFiltersHref(layoutView === "list" ? "list" : undefined);

  return (
    <MarketingEmptyState
      variant="panel"
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
            <Button variant="cta" asChild>
              <Link href={clearHref}>Clear filters</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/search">Browse all lots</Link>
            </Button>
          </>
        ) : (
          <>
            <Button variant="cta" asChild>
              <Link href="/search">Browse all lots</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/sales">View upcoming sales</Link>
            </Button>
          </>
        )
      }
    />
  );
}
