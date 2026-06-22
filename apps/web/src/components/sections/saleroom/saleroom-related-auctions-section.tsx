import { mapSaleToRelatedVM } from "@/components/sections/saleroom/mappers";
import { SaleroomRelatedAuctions } from "@/components/sections/saleroom/saleroom-related-auctions";
import type { RelatedSale } from "@/lib/data/http/saleroom.server";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

type Props = {
  relatedSales: RelatedSale[];
};

/** Related auctions rail — data is fetched once by the sale page orchestrator. */
export function SaleroomRelatedAuctionsSection({ relatedSales }: Props) {
  const relatedVMs = relatedSales.map((r) => mapSaleToRelatedVM(r.sale, r.lotCount));
  if (relatedVMs.length === 0) return null;
  return (
    <section className={cn(MARKETING_PAGE_SHELL, "pt-[var(--section-spacing)]")}>
      <SaleroomRelatedAuctions related={relatedVMs} />
    </section>
  );
}
