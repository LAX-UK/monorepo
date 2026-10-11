import type { LaxStaffAccessProduct } from "./domain-event-catalog/lax-staff-access-payload-schemas.js";
import { type UserStaffRole, userStaffRoles } from "./user.js";

/** Mirrors `shop_staff_role`; shop-api pins the two lists together in a parity test. */
export const laxShopStaffRoles = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
] as const;
export type LaxShopStaffRole = (typeof laxShopStaffRoles)[number];

export type LaxStaffRoleOption = {
  value: string;
  label: string;
  /** One line on what the role can do, shown next to the role picker. */
  summary: string;
};

export type LaxStaffPlatform = {
  product: LaxStaffAccessProduct;
  label: string;
  description: string;
  roles: readonly LaxStaffRoleOption[];
};

export type LaxStaffGrant = { product: LaxStaffAccessProduct; role: string };

const BID_ROLE_OPTIONS: Record<UserStaffRole, Omit<LaxStaffRoleOption, "value">> = {
  super_admin: {
    label: "Super admin",
    summary: "Full access, including staff access and security policy.",
  },
  auction_manager: { label: "Auction manager", summary: "Runs sales and auction schedules." },
  catalogue_manager: { label: "Catalogue manager", summary: "Edits lots and reviews artists." },
  specialist: { label: "Specialist", summary: "Appraises consignments and reviews artists." },
  finance_ops: { label: "Finance", summary: "Reads finance and processes payouts." },
  operations_fulfilment: {
    label: "Operations fulfilment",
    summary: "Handles post-sale fulfilment.",
  },
  content_marketing: { label: "Content & marketing", summary: "Edits site content." },
  support_concierge: { label: "Support concierge", summary: "Responds to client support." },
  staff_viewer: { label: "Staff viewer", summary: "Read-only access to entities and artists." },
  compliance_officer: {
    label: "Compliance officer",
    summary: "AML review and source-of-funds decisions.",
  },
  client_advisor: { label: "Client advisor", summary: "Reads clients and their bids." },
  operations: {
    label: "Operations",
    summary: "Catalogue, auctions and fulfilment without finance.",
  },
};

const SHOP_ROLE_OPTIONS: Record<LaxShopStaffRole, Omit<LaxStaffRoleOption, "value">> = {
  shop_admin: { label: "Shop admin", summary: "Full Shop access, including staff and settings." },
  account_manager: {
    label: "Account manager",
    summary: "Sale authority, original sales, holds and all clients.",
  },
  broker: { label: "Broker", summary: "Stock holds and assigned clients." },
  operations: { label: "Operations", summary: "Production, fulfilment and third-party sales." },
  finance: { label: "Finance", summary: "Fees, refunds, payouts and audit." },
  catalogue_editor: { label: "Catalogue editor", summary: "Edits the Shop catalogue." },
};

export const LAX_STAFF_PLATFORMS: readonly LaxStaffPlatform[] = [
  {
    product: "bid",
    label: "Bid",
    description: "Auctions, consignments and the LAX admin console.",
    roles: userStaffRoles.map((value) => ({ value, ...BID_ROLE_OPTIONS[value] })),
  },
  {
    product: "shop",
    label: "Shop",
    description: "Editions, originals, orders and Shop Admin.",
    roles: laxShopStaffRoles.map((value) => ({ value, ...SHOP_ROLE_OPTIONS[value] })),
  },
];

export function laxStaffPlatform(product: LaxStaffAccessProduct): LaxStaffPlatform {
  const platform = LAX_STAFF_PLATFORMS.find((p) => p.product === product);
  if (!platform) throw new Error(`Unknown LAX platform: ${product}`);
  return platform;
}

export function laxStaffRoleOption(
  product: LaxStaffAccessProduct,
  role: string,
): LaxStaffRoleOption | null {
  return laxStaffPlatform(product).roles.find((r) => r.value === role) ?? null;
}

/**
 * Validates a set of grants: known platforms, a valid role per platform and at most one
 * grant per platform. Returns the grants in catalogue order or a message for the caller.
 */
export function normalizeLaxStaffGrants(
  grants: readonly { product: string; role: string }[],
): { ok: true; grants: LaxStaffGrant[] } | { ok: false; message: string } {
  const byProduct = new Map<string, string>();
  for (const grant of grants) {
    const platform = LAX_STAFF_PLATFORMS.find((p) => p.product === grant.product);
    if (!platform) return { ok: false, message: `Unknown platform: ${grant.product}` };
    if (byProduct.has(grant.product)) {
      return { ok: false, message: `Only one role per platform (${platform.label})` };
    }
    if (!platform.roles.some((r) => r.value === grant.role)) {
      return { ok: false, message: `Unknown ${platform.label} role: ${grant.role}` };
    }
    byProduct.set(grant.product, grant.role);
  }
  return {
    ok: true,
    grants: LAX_STAFF_PLATFORMS.flatMap((p) => {
      const role = byProduct.get(p.product);
      return role ? [{ product: p.product, role }] : [];
    }),
  };
}
