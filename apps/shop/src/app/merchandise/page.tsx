import { isShopMerchandiseEnabled } from "@/lib/shop-runtime-flags";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ShopMerchandisePage() {
  if (!isShopMerchandiseEnabled()) {
    notFound();
  }

  return (
    <main id="main-content">
      <h1>Merchandise</h1>
      <p>LAX merchandise will appear here when catalogue data is available.</p>
    </main>
  );
}
