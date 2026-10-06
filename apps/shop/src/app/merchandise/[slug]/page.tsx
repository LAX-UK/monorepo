import { MerchandiseVariantPicker } from "@/components/merchandise/merchandise-variant-picker.client";
import { fetchPublicMerchandiseProduct } from "@/lib/shop-api.server";
import { isShopMerchandiseEnabled } from "@/lib/shop-runtime-flags";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ShopMerchandiseProductPage({ params }: Props) {
  if (!isShopMerchandiseEnabled()) {
    notFound();
  }
  const { slug } = await params;
  const product = await fetchPublicMerchandiseProduct(slug);
  if (!product) {
    notFound();
  }

  return (
    <main id="main-content">
      <h1>{product.title}</h1>
      {product.description ? <p>{product.description}</p> : null}
      <MerchandiseVariantPicker product={product} />
    </main>
  );
}
