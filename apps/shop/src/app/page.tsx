import { ShopHomePage } from "@/components/shop-home-page";
import { MARKETING_CATALOG_PT } from "@auction/branding";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Limited editions and prints | LAX Shop",
  description:
    "Limited-edition prints with the edition size stated on every work. Prices include VAT.",
  alternates: { canonical: "/" },
};

export default async function ShopHomePageRoute() {
  return (
    <main id="main-content" className={cn("shop-home shop-home--marketing", MARKETING_CATALOG_PT)}>
      <ShopHomePage />
    </main>
  );
}
