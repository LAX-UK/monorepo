import { retiredShopAccountPageDestination } from "@/lib/account/shop-account-routes";
import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Owned editions live in the LAX Account portfolio, filtered to LAX Shop. */
export default function ShopAccountEditionsRedirect() {
  permanentRedirect(retiredShopAccountPageDestination("editions", null));
}
