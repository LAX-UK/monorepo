import type { StaffProduct } from "./types.js";

export type StaffProductId = StaffProduct["id"];

/** Order the tools appear in the switcher, whichever tool the person is in. */
export const STAFF_PRODUCT_IDS: readonly StaffProductId[] = ["bid-admin", "lax-admin"];

const CATALOGUE: Record<StaffProductId, Omit<StaffProduct, "href">> = {
  "bid-admin": {
    id: "bid-admin",
    name: "Bid admin",
    description: "LAX Bid: sales, lots, bidders and payments",
  },
  "lax-admin": {
    id: "lax-admin",
    name: "LAX Admin",
    description: "lax.art and LAX Shop: catalogue, orders, editorial",
  },
};

/**
 * The switcher's tool list, built the same way in both staff tools. The tool you are in is always
 * listed, with its own address. Another tool is listed only when the person can open it
 * (`accessible`) and its address is configured, so nobody is offered a door that turns them away.
 * Each tool still enforces its own permissions when the link is followed.
 */
export function buildStaffProducts({
  current,
  accessible,
  hrefs,
}: {
  current: StaffProductId;
  /** The tools the signed-in person can open, from the Bid API's "my tools" answer. */
  accessible: readonly StaffProductId[];
  /** Where each tool lives; null or missing when that tool is not configured. */
  hrefs: Partial<Record<StaffProductId, string | null>>;
}): StaffProduct[] {
  return STAFF_PRODUCT_IDS.flatMap((id): StaffProduct[] => {
    const href = hrefs[id];
    if (!href) return [];
    if (id !== current && !accessible.includes(id)) return [];
    return [{ ...CATALOGUE[id], href }];
  });
}
