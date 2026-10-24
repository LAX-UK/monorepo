import { retiredShopAccountPageDestination } from "@/lib/account/shop-account-routes";
import { loadShopCrossProductFooterLinks } from "@/lib/ecosystem/product-directory.server";
import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Enquiries are tracked conversations on lax.art. */
export default function ShopAccountEnquiriesRedirect() {
  const art = loadShopCrossProductFooterLinks().find((link) => link.id === "art");
  permanentRedirect(retiredShopAccountPageDestination("enquiries", art?.href ?? null));
}
