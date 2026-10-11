import "server-only";

import { loadBidProductDirectoryLinks } from "@/lib/ecosystem/product-directory.server";
import { type LaxStaffAccessProduct, laxStaffPlatform } from "@auction/types";

export type StaffAccessLaunchLink = {
  product: LaxStaffAccessProduct;
  label: string;
  description: string;
  href: string;
  cta: string;
  external: boolean;
};

function shopAdminUrl(): string | null {
  const raw = process.env.LAX_SHOP_ADMIN_URL?.trim() || process.env.SHOP_ADMIN_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Where each platform's staff work happens: Bid admin here, Shop Admin on its own host. */
export function loadStaffAccessLaunchLinks(
  products: readonly LaxStaffAccessProduct[],
): StaffAccessLaunchLink[] {
  const directory = loadBidProductDirectoryLinks();
  return products.map((product) => {
    const platform = laxStaffPlatform(product);
    if (product === "bid") {
      return {
        product,
        label: platform.label,
        description: platform.description,
        href: "/admin",
        cta: "Open Bid admin",
        external: false,
      };
    }
    const admin = shopAdminUrl();
    const storefront = directory.find((link) => link.id === "shop")?.href ?? null;
    return {
      product,
      label: platform.label,
      description: platform.description,
      href: admin ?? storefront ?? "/",
      cta: admin ? "Open Shop Admin" : "Open LAX Shop",
      external: true,
    };
  });
}
