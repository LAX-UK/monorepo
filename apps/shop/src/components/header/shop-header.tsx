import { ShopHeaderClient } from "@/components/header/shop-header.client";
import { loadShopProductDirectoryLinks } from "@/lib/ecosystem/product-directory.server";
import { loadShopAccountChromeState } from "@/lib/ecosystem/shop-account-chrome.server";
import { fetchShopBasket } from "@/lib/shop-commerce.server";

/** Server composition root — session + product directory VMs, client island for mobile nav. */
export async function ShopHeader() {
  const [account, productLinks, basket] = await Promise.all([
    loadShopAccountChromeState(),
    Promise.resolve(loadShopProductDirectoryLinks()),
    fetchShopBasket(),
  ]);
  const basketCount =
    basket.status === "ok"
      ? basket.data.lines.reduce((total, line) => total + line.quantity, 0)
      : 0;

  return (
    <ShopHeaderClient account={account} productLinks={productLinks} basketCount={basketCount} />
  );
}
