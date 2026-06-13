import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { SaleroomRelatedAuctionCard } from "./saleroom-related-auction-card";
import type { RelatedSaleVM } from "./view-models";

type Props = {
  related: RelatedSaleVM[];
  title?: string;
  viewAllHref?: string;
};

export function SaleroomRelatedAuctions({
  related,
  title = "Related Auctions",
  viewAllHref = "/sales",
}: Props) {
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related-auctions-title" className="flex flex-col gap-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <h2
          id="related-auctions-title"
          className="text-[40px] font-semibold leading-[60px] tracking-tight text-brand-900 dark:text-on-surface"
        >
          {title}
        </h2>
        <Link
          href={viewAllHref}
          className="inline-flex min-h-6 items-center gap-2.5 text-center font-body text-base font-semibold tracking-[0.8px] text-brand-900 underline underline-offset-4 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-on-surface"
        >
          View all
          <ChevronRight
            className="size-5 shrink-0 text-brand-900 dark:text-on-surface"
            aria-hidden
          />
        </Link>
      </div>
      <ul className="m-0 flex list-none flex-col gap-0 p-0">
        {related.map((sale) => (
          <SaleroomRelatedAuctionCard key={sale.id} sale={sale} />
        ))}
      </ul>
    </section>
  );
}
