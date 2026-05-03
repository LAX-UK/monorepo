import { getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { metadataForNotFound, metadataForSale } from "@/lib/seo/metadata-factory";
import { salePath } from "@/lib/seo/url";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getServerSaleWithLots(id).catch(() => null);
  if (!bundle) {
    return metadataForNotFound("Sale not found");
  }
  return {
    ...metadataForSale(bundle.sale),
    robots: { index: false, follow: true },
  };
}

export default async function SaleLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  const bundle = await getServerSaleWithLots(id).catch(() => null);
  if (!bundle) notFound();
  permanentRedirect(salePath(bundle.sale));
}
