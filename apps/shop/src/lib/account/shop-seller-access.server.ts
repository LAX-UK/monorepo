import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import {
  type ShopSellerAccess,
  type ShopSellerProbe,
  type ShopSellerTool,
  opensSellerTool,
  probeFromListStatus,
  resolveShopSellerAccess,
} from "@/lib/account/shop-seller-access";
import {
  fetchPortalArtistArtworks,
  fetchPortalPayouts,
  fetchPortalSaleAuthority,
  fetchPortalSales,
  resolveShopPortalOwnershipEnabled,
} from "@/lib/shop-portal.server";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { redirect } from "next/navigation";
import { cache } from "react";

async function probeArtist(): Promise<ShopSellerProbe> {
  const result = await fetchPortalArtistArtworks();
  if (result.status === "ok") return result.data.artist ? "yes" : "no";
  if (result.status === "commerce_unavailable") return "no";
  return "unknown";
}

/** The signed-in viewer's seller roles, looked up once per request. */
export const loadShopSellerAccess = cache(async (): Promise<ShopSellerAccess> => {
  const payoutsEnabled = isShopPayoutsEnabled();
  const ownershipEnabled = await resolveShopPortalOwnershipEnabled();
  const [saleAuthority, payouts, sales, artist] = await Promise.all([
    ownershipEnabled ? fetchPortalSaleAuthority() : null,
    payoutsEnabled ? fetchPortalPayouts() : null,
    payoutsEnabled ? fetchPortalSales() : null,
    probeArtist(),
  ]);
  return resolveShopSellerAccess({
    ownershipEnabled,
    payoutsEnabled,
    saleAuthority: saleAuthority ? probeFromListStatus(saleAuthority.status) : "no",
    payouts: payouts ? probeFromListStatus(payouts.status) : "no",
    sales: sales ? probeFromListStatus(sales.status) : "no",
    artist,
  });
});

/** Sends a viewer without the role back to their orders; returns the access for the page nav. */
export async function requireShopSellerTool(tool: ShopSellerTool): Promise<ShopSellerAccess> {
  const access = await loadShopSellerAccess();
  if (!opensSellerTool(access, tool)) redirect(SHOP_ORDERS_HREF);
  return access;
}
