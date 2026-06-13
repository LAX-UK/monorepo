import { mapSaleToRelatedVM } from "@/components/sections/saleroom/mappers";
import { SaleroomRelatedAuctions } from "@/components/sections/saleroom/saleroom-related-auctions";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { saleroomPageDataService } from "@/lib/marketing/saleroom-page-data.service";
import type { Sale } from "@auction/types";
import { cn } from "@auction/ui";

export async function SaleroomRelatedAuctionsSection({
  saleId,
  sale,
}: {
  saleId: string;
  sale: Sale;
}) {
  const session = await getServerSessionUser();
  const { relatedSales } = await saleroomPageDataService.loadSecondary(saleId, sale, session);
  const relatedVMs = relatedSales.map((r) => mapSaleToRelatedVM(r.sale, r.lotCount));
  if (relatedVMs.length === 0) return null;
  return (
    <section className={cn(MARKETING_PAGE_SHELL, "mt-20")}>
      <SaleroomRelatedAuctions related={relatedVMs} />
    </section>
  );
}
