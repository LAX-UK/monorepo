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
  ],
  broker: ["stock_hold.write", "client.read_assigned", "purchase_price.read_assigned"],
  operations: ["production.write", "fulfilment.write", "third_party_sale.write"],
  finance: ["fee.approve", "refund.write", "payout.mark_paid", "audit.read"],
  catalogue_editor: ["catalogue.write"],
};

export function capabilitiesForRole(role: ShopStaffRole): readonly ShopStaffCapability[] {
  return ROLE_CAPABILITIES[role];
}

export function roleHasCapability(role: ShopStaffRole, capability: ShopStaffCapability): boolean {
  return capabilitiesForRole(role).includes(capability);
}
