import { retiredShopAccountPageDestination } from "@/lib/account/shop-account-routes";
import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Certificates and invoices sit on each work in the LAX Account portfolio. */
export default function ShopAccountDocumentsRedirect() {
  permanentRedirect(retiredShopAccountPageDestination("documents", null));
}
