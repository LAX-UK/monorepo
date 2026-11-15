import { SaleroomCancelledNotice } from "@/components/sections/saleroom/saleroom-cancelled-notice";
import { SaleroomDetailView } from "@/components/sections/saleroom/saleroom-detail-view";
import {
  loadSaleroomDetailMetadataShell,
  loadSaleroomDetailPage,
} from "@/lib/marketing/load-saleroom-detail-page";
import { metadataForNotFound, metadataForSale } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

/*
 * The HTML of this page is rendered per request (the root layout reads the visitor's session and
 * the CSP nonce); only its session-free API reads are shared, in the Data Cache, under the sale's
 * tag. Never add a route-level `revalidate`, full-route caching or a CDN rule for `/sales/*`: the
 * same HTML carries the visitor's layout. `lib/cache/public-page-session-free.test.ts` holds this.
 */

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const sp = await searchParams;
  const shell = await loadSaleroomDetailMetadataShell(id, slug, sp);
  if (!shell) {
    return metadataForNotFound("Sale not found");
  }
  if (shell.sale.status === "cancelled") {
    return metadataForNotFound(`${shell.sale.title} was cancelled`);
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
  if (data.kind === "cancelled") return <SaleroomCancelledNotice saleTitle={data.saleTitle} />;
  return <SaleroomDetailView {...data} />;
}

export type { SaleLotsPage } from "@/lib/data/http/sales.server";
