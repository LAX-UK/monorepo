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
  title = "Related auctions",
  viewAllHref = "/sales",
}: Props) {
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related-auctions-title" className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <h2
          id="related-auctions-title"
          className="font-headline text-2xl text-on-surface md:text-3xl"
        >
          {title}
        </h2>
        <Link
          href={viewAllHref}
          className="inline-flex min-h-9 items-center gap-1 font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View all auctions
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {related.map((sale) => (
          <li key={sale.id}>
            <SaleroomRelatedAuctionCard sale={sale} />
          </li>
        ))}
      </ul>
    </section>
  );
}
