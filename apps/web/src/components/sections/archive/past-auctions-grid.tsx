import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import Link from "next/link";

export type { ArchiveLotVM } from "./catalog-archive-views";

/** Empty state when no archive rows match filters. */
export function PastAuctionsEmpty() {
  return (
    <MarketingEmptyState
      variant="panel"
      title="No past auctions match these filters."
      description={
        <p className="mb-6 font-body text-on-surface-variant">
          Try adjusting filters or browse the full catalogue.
        </p>
      }
      action={
        <>
          <Link
            href="/search"
            className="inline-flex items-center justify-center border-b-2 border-primary pb-1 font-label text-xs font-bold uppercase tracking-widest text-primary transition-opacity hover:opacity-80"
          >
            Browse all lots
          </Link>
          <Link
            href="/archive"
            className="inline-flex items-center justify-center border-b-2 border-primary pb-1 font-label text-xs font-bold uppercase tracking-widest text-primary transition-opacity hover:opacity-80"
          >
            View full archive
          </Link>
          <span className="hidden text-on-surface-variant sm:inline" aria-hidden>
            ·
          </span>
          <Link
            href="/"
            className="inline-flex items-center justify-center font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            Back to upcoming auctions
          </Link>
        </>
      }
    />
  );
}
