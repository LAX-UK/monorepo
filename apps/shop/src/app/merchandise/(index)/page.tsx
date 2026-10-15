import { fetchPublicMerchandiseProducts } from "@/lib/shop-api.server";
import { isShopMerchandiseEnabled } from "@/lib/shop-runtime-flags";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatPricePence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export default async function ShopMerchandisePage() {
  if (!isShopMerchandiseEnabled()) {
    notFound();
  }

  const catalogue = await fetchPublicMerchandiseProducts();

  return (
    <main id="main-content">
      <h1>Merchandise</h1>
      {catalogue.items.length === 0 ? (
        <p>LAX merchandise will appear here when catalogue data is available.</p>
      ) : (
        <ul>
          {catalogue.items.map((item) => (
            <li key={item.slug}>
              <Link href={`/merchandise/${item.slug}`}>{item.title}</Link>
              <span>{formatPricePence(item.fromPricePence)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
