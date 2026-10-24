import { retiredShopAccountPageDestination } from "@/lib/account/shop-account-routes";
import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The collection lives in the LAX Account portfolio. */
export default function ShopAccountCollectionRedirect() {
  permanentRedirect(retiredShopAccountPageDestination("collection", null));
}
