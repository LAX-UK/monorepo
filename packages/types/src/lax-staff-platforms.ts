import type { LaxStaffAccessProduct } from "./domain-event-catalog/lax-staff-access-payload-schemas.js";
import { type UserStaffRole, normalizeUserStaffRole, userStaffRoles } from "./user.js";

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
  /** One person may hold several of this platform's roles at once (Bid); otherwise one. */
  multipleRoles: boolean;
};

export type LaxStaffGrant = { product: LaxStaffAccessProduct; role: string };

const BID_ROLE_OPTIONS: Record<UserStaffRole, Omit<LaxStaffRoleOption, "value">> = {
  administrator: {
    label: "Administrator",
    summary: "Runs the platform: full access, including staff, roles and security policy.",
  },
  sales_manager: { label: "Sales manager", summary: "Sets up and runs sales." },
  saleroom_clerk: {
    label: "Saleroom clerk",
    summary: "Runs the live saleroom: telephone bids, paddles and check-in.",
  },
  cataloguer: { label: "Cataloguer", summary: "Lots, categories and artists." },
  specialist: { label: "Specialist", summary: "Reviews and appraises submissions." },
  client_services: {
    label: "Client services",
    summary: "Helps clients and follows their bids.",
  },
  finance: { label: "Finance", summary: "Payments and payouts." },
  fulfilment: { label: "Fulfilment", summary: "Shipping and collection." },
  compliance: {
    label: "Compliance",
    summary: "Anti-money-laundering review and source-of-funds decisions.",
  },
  read_only: {
    label: "Read-only",
    summary: "Sees admin pages without personal data, money or actions.",
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
    multipleRoles: true,
  },
  {
    product: "shop",
    label: "Shop",
    description: "Editions, originals, orders and Shop Admin.",
    roles: laxShopStaffRoles.map((value) => ({ value, ...SHOP_ROLE_OPTIONS[value] })),
    multipleRoles: false,
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
 * Validates a set of grants: known platforms, a valid role on each, no role twice, and one role
 * per platform unless the platform allows several. Returns the grants in catalogue order
 * (platform, then role) or a message for the caller. Which roles may be held together is a role
 * rule, checked separately with `checkStaffRoleSet`.
 */
export function normalizeLaxStaffGrants(
  grants: readonly { product: string; role: string }[],
): { ok: true; grants: LaxStaffGrant[] } | { ok: false; message: string } {
  const byProduct = new Map<string, Set<string>>();
  for (const grant of grants) {
    const platform = LAX_STAFF_PLATFORMS.find((p) => p.product === grant.product);
    if (!platform) return { ok: false, message: `Unknown platform: ${grant.product}` };
    const option = platform.roles.find((r) => r.value === grant.role);
    if (!option) {
      return { ok: false, message: `Unknown ${platform.label} role: ${grant.role}` };
    }
    const roles = byProduct.get(grant.product) ?? new Set<string>();
    if (roles.has(grant.role)) {
      return { ok: false, message: `${platform.label} role chosen twice (${option.label})` };
    }
    if (roles.size > 0 && !platform.multipleRoles) {
      return { ok: false, message: `Only one role per platform (${platform.label})` };
    }
    roles.add(grant.role);
    byProduct.set(grant.product, roles);
  }
  return {
    ok: true,
    grants: LAX_STAFF_PLATFORMS.flatMap((platform) => {
      const roles = byProduct.get(platform.product);
      if (!roles) return [];
      return platform.roles
        .filter((option) => roles.has(option.value))
        .map((option) => ({ product: platform.product, role: option.value }));
    }),
  };
}

/** The most grants one invitation can carry: every role where several are allowed, else one. */
export const MAX_LAX_STAFF_GRANTS = LAX_STAFF_PLATFORMS.reduce(
  (total, platform) => total + (platform.multipleRoles ? platform.roles.length : 1),
  0,
);

/** The Bid staff roles among `grants`, in catalogue order. */
export function bidStaffRolesFromGrants(grants: readonly LaxStaffGrant[]): UserStaffRole[] {
  const roles = new Set(grants.filter((grant) => grant.product === "bid").map((g) => g.role));
  return userStaffRoles.filter((role) => roles.has(role));
}

/** The staff tools a person can switch between. Matches the staff kit's product ids. */
export const STAFF_TOOL_IDS = ["bid-admin", "lax-admin"] as const;
export type StaffToolId = (typeof STAFF_TOOL_IDS)[number];

/** The Bid API's answer to "which staff tools can this person open?". */
export type StaffToolsAccess = { tools: StaffToolId[] };

/**
 * Maps the roles a person holds on each platform to the staff tools they can open. Bid admin
 * needs a Bid staff role; LAX Admin needs a Shop staff role. A role a platform no longer knows
 * opens nothing, so a stale directory row cannot offer a tool that would refuse the person.
 */
export function staffToolsFromGrants(grants: readonly LaxStaffGrant[]): StaffToolId[] {
  const tools = new Set<StaffToolId>();
  for (const { product, role } of grants) {
    if (product === "bid" && normalizeUserStaffRole(role) !== null) tools.add("bid-admin");
    if (product === "shop" && (laxShopStaffRoles as readonly string[]).includes(role)) {
      tools.add("lax-admin");
    }
  }
  return STAFF_TOOL_IDS.filter((id) => tools.has(id));
}
