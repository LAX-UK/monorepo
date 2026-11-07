import { ShopHeaderClient } from "@/components/header/shop-header.client";
import { shopFinishPaying } from "@/lib/account/shop-orders.vm";
import { loadShopFamilyLinks } from "@/lib/ecosystem/product-directory.server";
import { loadShopAccountChromeState } from "@/lib/ecosystem/shop-account-chrome.server";
import { loadShopHeaderNav } from "@/lib/ecosystem/shop-header-nav.server";
import { fetchShopBasket, listShopOrders } from "@/lib/shop-commerce.server";
import { isShopMerchandiseEnabled } from "@/lib/shop-runtime-flags";

/** Server composition root — session + product directory VMs, client island for mobile nav. */
export async function ShopHeader() {
  const [account, familyLinks, basket, navData] = await Promise.all([
    loadShopAccountChromeState(),
    Promise.resolve(loadShopFamilyLinks()),
    fetchShopBasket(),
    loadShopHeaderNav(),
  ]);
  // The Account dot: a signed-in shopper has an unpaid checkout still reserved. A failed read
  // shows no dot rather than an error in the chrome.
  const accountNeedsAction =
    account.kind === "authenticated" &&
    (await listShopOrders().then(
      (orders) => orders.status === "ok" && shopFinishPaying(orders.data, new Date()) !== null,
      () => false,
    ));
  const basketCount =
    basket.status === "ok"
      ? basket.data.lines.reduce((total, line) => total + line.quantity, 0)
      : 0;

  return (
    <ShopHeaderClient
      account={account}
      familyLinks={familyLinks}
      basketCount={basketCount}
      accountNeedsAction={accountNeedsAction}
      merchandiseEnabled={isShopMerchandiseEnabled()}
      navData={navData}
    />
  );
}
