export const SHOP_STAFF_CAPABILITIES = [
  "catalogue.write",
  /** Opening artworks, edition runs, artists and categories without changing them. */
  "catalogue.read",
  /** Setting or changing an edition's price. Kept apart from catalogue edits because it is money. */
  "artwork_price.write",
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
  /** Opening stories, exhibitions, venues, pages and help without changing them. */
  "editorial.read",
  "enquiry.read",
  "enquiry.write",
  "order.read",
  /** Reviewing artists' applications to join the gallery, and accepting or declining them. */
  "artist_application.review",
  /**
   * Correcting a run's edition facts after prints have sold. Administrators only: the orders
   * already paid were described the old way.
   */
  "edition_facts.correct",
  /** Approving the listing of hors commerce proofs, which were not made to be sold. */
  "hors_commerce.approve",
  /**
   * Erasing a guest's personal data on request. Administrators only: it cannot be undone, and it
   * removes the only way to contact the guest about their orders.
   */
  "lead.erase",
  /**
   * Seeing the name and address kept on an erased guest's orders for the accounting record. Only
   * the people who handle invoices hold it.
   */
  "retained_invoice_data.read",
] as const;

export type ShopStaffCapability = (typeof SHOP_STAFF_CAPABILITIES)[number];

/** LAX Admin's staff roles. `shop_admin` is the Administrator. Mirrors `shop_staff_role`. */
export const SHOP_STAFF_ROLES = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
  "editor",
  "read_only",
] as const;

export type ShopStaffRole = (typeof SHOP_STAFF_ROLES)[number];

/**
 * What the Read-only role sees: the order, enquiry, merchandise, catalogue and editorial lists and
 * records, with every action closed. No client lists or records, no buying prices and no audit log, whose entries
 * carry prices and personal details.
 */
export const READ_ONLY_CAPABILITIES = [
  "order.read",
  "enquiry.read",
  "merchandise.read",
  "catalogue.read",
  "editorial.read",
] as const satisfies readonly ShopStaffCapability[];

/**
 * Writing a kind of record includes reading it. The role table below lists only what each role is
 * given; this rule adds the matching read, so no role can write what it cannot open.
 */
export const READ_IMPLIED_BY_WRITE = {
  "catalogue.write": "catalogue.read",
  "editorial.write": "editorial.read",
} as const satisfies Partial<Record<ShopStaffCapability, ShopStaffCapability>>;

function withImpliedReads(granted: readonly ShopStaffCapability[]): readonly ShopStaffCapability[] {
  const all = new Set(granted);
  for (const [write, read] of Object.entries(READ_IMPLIED_BY_WRITE))
    if (all.has(write as ShopStaffCapability)) all.add(read);
  return [...all];
}

const GRANTED_CAPABILITIES: Record<ShopStaffRole, readonly ShopStaffCapability[]> = {
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
  finance: [
    "retained_invoice_data.read",
    "fee.approve",
    "refund.write",
    "payout.mark_paid",
    "audit.read",
    "order.read",
    "artwork_price.write",
  ],
  /** Artworks, edition runs and stock, artists, and artists' applications. */
  catalogue_editor: ["catalogue.write", "artist_application.review"],
  /** Stories, exhibitions, venues, pages and help, written and published. */
  editor: ["editorial.write", "editorial.publish"],
  read_only: READ_ONLY_CAPABILITIES,
};

const ROLE_CAPABILITIES = Object.fromEntries(
  SHOP_STAFF_ROLES.map((role) => [role, withImpliedReads(GRANTED_CAPABILITIES[role])]),
) as Record<ShopStaffRole, readonly ShopStaffCapability[]>;

export function capabilitiesForRole(role: ShopStaffRole): readonly ShopStaffCapability[] {
  return ROLE_CAPABILITIES[role];
}

/** What a person holding `roles` may do: the union of each role's capabilities. */
export function capabilitiesForRoles(
  roles: readonly ShopStaffRole[],
): ReadonlySet<ShopStaffCapability> {
  const capabilities = new Set<ShopStaffCapability>();
  for (const role of roles)
    for (const capability of ROLE_CAPABILITIES[role]) capabilities.add(capability);
  return capabilities;
}

/** Whether any of `roles` holds `capability`. */
export function rolesHaveCapability(
  roles: readonly ShopStaffRole[],
  capability: ShopStaffCapability,
): boolean {
  return roles.some((role) => ROLE_CAPABILITIES[role].includes(capability));
}

/** The roles that hold `capability`, in role order: for "who can do this" lists. */
export function rolesGranting(capability: ShopStaffCapability): ShopStaffRole[] {
  return SHOP_STAFF_ROLES.filter((role) => ROLE_CAPABILITIES[role].includes(capability));
}

/**
 * The capability that lets staff open the list behind each overview figure. A figure is shown to
 * a person only when they hold the capability, so a count never reaches someone who cannot see
 * the records it counts.
 */
export const OVERVIEW_KPI_CAPABILITY = {
  fulfilmentOpenCount: "fulfilment.write",
  payoutsDueCount: "payout.mark_paid",
  activeHoldsCount: "stock_hold.write",
  pendingAuthorityRequestsCount: "sale_authority.write",
} as const satisfies Record<string, ShopStaffCapability>;

export type OverviewKpiKey = keyof typeof OVERVIEW_KPI_CAPABILITY;

/** Open editions low on stock are shown to the staff who can add prints to them. */
export const OVERVIEW_LOW_STOCK_CAPABILITY: ShopStaffCapability = "catalogue.write";

/** The overview figures a person with `capabilities` may see. */
export function overviewKpiKeysFor(capabilities: ReadonlySet<string>): OverviewKpiKey[] {
  return (Object.keys(OVERVIEW_KPI_CAPABILITY) as OverviewKpiKey[]).filter((key) =>
    capabilities.has(OVERVIEW_KPI_CAPABILITY[key]),
  );
}

/** Which clients a staff member can list: everyone, only those assigned to them, or nobody. */
export type ClientListScope = "all" | "assigned" | "none";

/**
 * The one rule for the Clients page. The nav shows the page and the API answers `GET /clients`
 * from this same scope, so a link is shown exactly when the list behind it will load.
 */
export function clientListScope(capabilities: Iterable<string>): ClientListScope {
  const held = new Set(capabilities);
  if (held.has("client.read_all")) return "all";
  if (held.has("client.read_assigned")) return "assigned";
  return "none";
}
