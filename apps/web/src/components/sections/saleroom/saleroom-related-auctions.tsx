import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { MarketingViewAllLink } from "@/components/marketing/marketing-view-all-link";
import { DisplayHeading } from "@auction/ui";
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
    <section aria-labelledby="related-auctions-title" className="flex flex-col gap-8">
      <MarketingSectionHeader
        heading={
          <DisplayHeading
            as="h2"
            id="related-auctions-title"
            size="section"
            className="font-semibold"
          >
            {title}
          </DisplayHeading>
        }
        action={<MarketingViewAllLink href={viewAllHref} srSuffix="auctions and sales" />}
      />
      <ul className="m-0 flex list-none flex-col gap-0 p-0">
        {related.map((sale, index) => (
          <SaleroomRelatedAuctionCard key={sale.id} sale={sale} index={index} />
        ))}
      </ul>
    </section>
  );
}
