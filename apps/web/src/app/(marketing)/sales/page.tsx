import { SalesBrowseView } from "@/components/sections/sales/sales-browse-view";
import { loadSalesBrowsePage } from "@/lib/marketing/load-sales-browse-page";
import { salesBrowsePageMetadata } from "@/lib/marketing/sales-browse-page.seo";

export const metadata = salesBrowsePageMetadata;

export default async function SalesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await loadSalesBrowsePage(sp);
  return <SalesBrowseView {...data} />;
}
