import "server-only";

import type { StaffProduct } from "@auction/staff-ui";

function shopAdminUrl(): string | null {
  const raw = process.env.LAX_SHOP_ADMIN_URL?.trim() || process.env.SHOP_ADMIN_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.hostname === "localhost"
      ? url.toString().replace(/\/+$/, "")
      : null;
  } catch {
    return null;
  }
}

/**
 * The staff tools offered in Bid admin's product switcher. Bid admin is always here; LAX Admin
 * appears when its address is configured, and applies its own permissions when it opens.
 */
export function loadStaffProducts(): StaffProduct[] {
  const products: StaffProduct[] = [
    {
      id: "bid-admin",
      name: "Bid admin",
      description: "LAX Bid: sales, lots, bidders and payments",
      href: "/admin",
    },
  ];
  const laxAdmin = shopAdminUrl();
  if (laxAdmin) {
    products.push({
      id: "lax-admin",
      name: "LAX Admin",
      description: "lax.art and LAX Shop: catalogue, orders, editorial",
      href: laxAdmin,
    });
  }
  return products;
}
