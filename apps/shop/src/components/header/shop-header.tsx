import { ShopHeaderClient } from "@/components/header/shop-header.client";
import { loadShopFamilyLinks } from "@/lib/ecosystem/product-directory.server";
import { loadShopAccountChromeState } from "@/lib/ecosystem/shop-account-chrome.server";
import { loadShopHeaderNav } from "@/lib/ecosystem/shop-header-nav.server";
import { shopTopBarMessage } from "@/lib/presenters/shop-top-bar-message";
import { fetchShopBasket } from "@/lib/shop-commerce.server";
import { isShopMerchandiseEnabled } from "@/lib/shop-runtime-flags";

/** Server composition root — session + product directory VMs, client island for mobile nav. */
export async function ShopHeader() {
  const [account, familyLinks, basket, navData] = await Promise.all([
    loadShopAccountChromeState(),
    Promise.resolve(loadShopFamilyLinks()),
    fetchShopBasket(),
    loadShopHeaderNav(),
  ]);
  const basketCount =
    basket.status === "ok"
      ? basket.data.lines.reduce((total, line) => total + line.quantity, 0)
      : 0;

  return (
    <ShopHeaderClient
      account={account}
      familyLinks={familyLinks}
      topBarMessage={shopTopBarMessage()}
      basketCount={basketCount}
      merchandiseEnabled={isShopMerchandiseEnabled()}
      navData={navData}
    />
  );
}
