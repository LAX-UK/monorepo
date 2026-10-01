import { notFound } from "next/navigation";

export default function ShopMerchandisePage() {
  if (process.env.SHOP_MERCHANDISE_ENABLED !== "true") {
    notFound();
  }

  return (
    <main id="main-content">
      <h1>Merchandise</h1>
      <p>LAX merchandise will appear here when catalogue data is available.</p>
    </main>
  );
}
