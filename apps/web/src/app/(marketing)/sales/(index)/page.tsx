import { SalesBrowseView } from "@/components/sections/sales/sales-browse-view";
import { loadSalesBrowsePage } from "@/lib/marketing/load-sales-browse-page";
import { salesBrowsePageMetadata } from "@/lib/marketing/sales-browse-page.seo";
import type { Metadata } from "next";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return salesBrowsePageMetadata(await searchParams);
}

export default async function SalesListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const data = await loadSalesBrowsePage(sp);
  return <SalesBrowseView {...data} />;
}
