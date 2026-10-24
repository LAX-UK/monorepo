export const SHOP_STAFF_CAPABILITIES = [
  "catalogue.write",
  "sale_authority.write",
  "stock_hold.write",
  "third_party_sale.write",
  "fee.approve",
  "production.write",
  "fulfilment.write",
  "original_sale.write",
  "refund.write",
  "payout.mark_paid",
  "client.read_assigned",
  "client.read_all",
  "purchase_price.read_assigned",
  "settings.write",
  "audit.read",
  "merchandise.read",
  "merchandise.write",
  "stock_hold.override",
  "editorial.write",
  "editorial.publish",
  "enquiry.read",
  "enquiry.write",
  "order.read",
] as const;

export type ShopStaffCapability = (typeof SHOP_STAFF_CAPABILITIES)[number];

export type ShopStaffRole =
  | "shop_admin"
  | "account_manager"
  | "broker"
  | "operations"
  | "finance"
  | "catalogue_editor";

const ROLE_CAPABILITIES: Record<ShopStaffRole, readonly ShopStaffCapability[]> = {
  shop_admin: SHOP_STAFF_CAPABILITIES,
  account_manager: [
    "sale_authority.write",
    "original_sale.write",
    "stock_hold.write",
    "stock_hold.override",
    "client.read_all",
    "enquiry.read",
    "enquiry.write",
    "order.read",
  ],
  broker: [
    "stock_hold.write",
    "client.read_assigned",
    "purchase_price.read_assigned",
    "enquiry.read",
  ],
  operations: [
    "production.write",
    "fulfilment.write",
    "third_party_sale.write",
    "order.read",
    "enquiry.read",
  ],
  finance: ["fee.approve", "refund.write", "payout.mark_paid", "audit.read", "order.read"],
  catalogue_editor: ["catalogue.write", "editorial.write", "editorial.publish"],
};

/**
 * The capability that lets staff open the list behind each overview figure. A figure is shown to
 * a role only when it holds the capability, so a count never reaches someone who cannot see the
 * records it counts.
 */
export const OVERVIEW_KPI_CAPABILITY = {
  fulfilmentOpenCount: "fulfilment.write",
  payoutsDueCount: "payout.mark_paid",
  activeHoldsCount: "stock_hold.write",
  pendingAuthorityRequestsCount: "sale_authority.write",
} as const satisfies Record<string, ShopStaffCapability>;

export type OverviewKpiKey = keyof typeof OVERVIEW_KPI_CAPABILITY;

export function overviewKpiKeysForRole(role: ShopStaffRole): OverviewKpiKey[] {
  return (Object.keys(OVERVIEW_KPI_CAPABILITY) as OverviewKpiKey[]).filter((key) =>
    roleHasCapability(role, OVERVIEW_KPI_CAPABILITY[key]),
  );
}

export function capabilitiesForRole(role: ShopStaffRole): readonly ShopStaffCapability[] {
  return ROLE_CAPABILITIES[role];
}

export function roleHasCapability(role: ShopStaffRole, capability: ShopStaffCapability): boolean {
  return capabilitiesForRole(role).includes(capability);
}

/** Which clients a staff member can list: everyone, only those assigned to them, or nobody. */
export type ClientListScope = "all" | "assigned" | "none";

/**
 * The one rule for the Clients page. The nav shows the page and the API answers `GET /clients`
 * from this same scope, so a link is shown exactly when the list behind it will load.
 */
export function clientListScope(capabilities: readonly string[]): ClientListScope {
  if (capabilities.includes("client.read_all")) return "all";
  if (capabilities.includes("client.read_assigned")) return "assigned";
  return "none";
}
