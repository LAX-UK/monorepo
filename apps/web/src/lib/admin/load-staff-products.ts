import "server-only";

import { getServerMyStaffTools } from "@/lib/data/http/staff-tools.server";
import { type StaffProduct, buildStaffProducts } from "@auction/staff-ui";

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
 * The staff tools offered in Bid admin's product switcher: Bid admin, plus LAX Admin when its
 * address is configured and the Bid API says this person holds a Shop staff role. LAX Admin
 * applies its own permissions when it opens.
 */
export async function loadStaffProducts(): Promise<StaffProduct[]> {
  return buildStaffProducts({
    current: "bid-admin",
    accessible: await getServerMyStaffTools(),
    hrefs: { "bid-admin": "/admin", "lax-admin": shopAdminUrl() },
  });
}
