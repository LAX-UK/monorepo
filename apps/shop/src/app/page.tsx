import { ShopHomePage } from "@/components/shop-home-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function ShopHomePageRoute() {
  return (
    <main id="main-content" className="shop-home shop-home--marketing">
      <ShopHomePage />
    </main>
  );
}
