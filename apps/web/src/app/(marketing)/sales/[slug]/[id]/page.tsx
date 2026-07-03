import { SaleroomDetailView } from "@/components/sections/saleroom/saleroom-detail-view";
import {
  loadSaleroomDetailMetadataShell,
  loadSaleroomDetailPage,
} from "@/lib/marketing/load-saleroom-detail-page";
import { metadataForNotFound, metadataForSale } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const shell = await loadSaleroomDetailMetadataShell(id, slug);
  if (!shell) {
    return metadataForNotFound("Sale not found");
  }
  return metadataForSale(shell.sale, {
    hasPress: (shell.sale.pressCoverage?.length ?? 0) > 0,
    hasDayMedia:
      shell.sale.status === "ended" &&
      (shell.sale.dayImageAssets?.length ?? shell.sale.dayImages?.length ?? 0) > 0,
  });
}

export default async function SaleDetailPage({ params, searchParams }: PageProps) {
  const { id, slug } = await params;
  const sp = await searchParams;
  const data = await loadSaleroomDetailPage({ id, slug, searchParams: sp });
  return <SaleroomDetailView {...data} />;
}

export type { SaleLotsPage } from "@/lib/data/http/sales.server";
