/**
 * Fixed ids and sign-ins for the demo top-up seed. Every row the seed writes has an id from here
 * (or a natural key such as an email), so running it again updates the same rows instead of
 * adding new ones.
 */

/** Same password as every other seeded sign-in. Test and local environments only. */
export const DEMO_PASSWORD = "Password123!";

function id(group: string, n: number): string {
  return `${group}-0000-4000-8000-${n.toString().padStart(12, "0")}`;
}

export const DEMO_IDS = {
  sale: (n: number) => id("de000000", n),
  lot: (n: number) => id("de100000", n),
  bid: (n: number) => id("de200000", n),
  payment: (n: number) => id("de300000", n),
  submission: (n: number) => id("de400000", n),
  payout: (n: number) => id("de500000", n),
  payoutLine: (n: number) => id("de510000", n),
  registration: (n: number) => id("de600000", n),
  watch: (n: number) => id("de700000", n),
  legalEntity: (n: number) => id("de800000", n),
  member: (n: number) => id("de900000", n),
  authorisation: (n: number) => id("dea00000", n),
  fulfilment: (n: number) => id("deb00000", n),
  user: (n: number) => id("9de00000", n),
} as const;

/** The people the demo needs. Found by email; created with these ids when missing. */
export type DemoPerson = {
  key: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  /** A Bid staff role; `null` for clients. */
  bidStaffRole: BidStaffRole | null;
  /** Clients get their own personal account (legal entity) to bid and buy with. */
  personalEntityId: string | null;
};

export type BidStaffRole =
  | "administrator"
  | "sales_manager"
  | "saleroom_clerk"
  | "cataloguer"
  | "specialist"
  | "client_services"
  | "finance"
  | "fulfilment"
  | "compliance"
  | "read_only";

function client(n: number, key: string, email: string, first: string, last: string): DemoPerson {
  return {
    key,
    userId: DEMO_IDS.user(n),
    email,
    firstName: first,
    lastName: last,
    bidStaffRole: null,
    personalEntityId: DEMO_IDS.legalEntity(n),
  };
}

function staff(
  n: number,
  key: string,
  email: string,
  first: string,
  last: string,
  role: BidStaffRole | null,
): DemoPerson {
  return {
    key,
    userId: DEMO_IDS.user(n),
    email,
    firstName: first,
    lastName: last,
    bidStaffRole: role,
    personalEntityId: null,
  };
}

export const DEMO_PEOPLE = {
  collector: client(1, "collector", "collector@lax.bid", "Charlotte", "Hayes"),
  northbankOwner: client(2, "northbankOwner", "northbank-owner@lax.bid", "Oliver", "Grant"),
  northbankBuyer: client(3, "northbankBuyer", "northbank-buyer@lax.bid", "Nadia", "Rahman"),
  rivalBidder: client(4, "rivalBidder", "bidder@lax.bid", "Thomas", "Avery"),
  // Bid staff: one sign-in per role. The emails match the local demo seed where it has the role.
  salesManager: staff(
    20,
    "salesManager",
    "staff-auction-mgr@lax.bid",
    "Alex",
    "Mercer",
    "sales_manager",
  ),
  clerk: staff(21, "clerk", "staff-clerk@lax.bid", "Kiran", "Shah", "saleroom_clerk"),
  cataloguer: staff(22, "cataloguer", "staff-catalogue@lax.bid", "Blair", "Chen", "cataloguer"),
  specialist: staff(
    23,
    "specialist",
    "platform-specialist@lax.bid",
    "Cameron",
    "Webb",
    "specialist",
  ),
  clientServices: staff(
    24,
    "clientServices",
    "staff-support@lax.bid",
    "Fiona",
    "Nguyen",
    "client_services",
  ),
  fulfilment: staff(25, "fulfilment", "staff-ops@lax.bid", "Dana", "Ortiz", "fulfilment"),
  compliance: staff(26, "compliance", "staff-compliance@lax.bid", "Laura", "Bennett", "compliance"),
  readOnly: staff(27, "readOnly", "staff-readonly@lax.bid", "Graham", "Holt", "read_only"),
  // LAX Admin staff (Shop and lax.art). Their LAX Admin roles are granted with `staff:grant`.
  laxOperations: staff(40, "laxOperations", "lax-operations@lax.bid", "Ruth", "Adeyemi", null),
  laxEditor: staff(41, "laxEditor", "lax-editor@lax.bid", "Tom", "Hale", null),
  laxCatalogue: staff(42, "laxCatalogue", "lax-catalogue@lax.bid", "Ellie", "Shaw", null),
  laxFinance: staff(43, "laxFinance", "lax-finance@lax.bid", "Grace", "Lin", null),
  laxAccounts: staff(44, "laxAccounts", "lax-accounts@lax.bid", "Sam", "Morley", null),
  laxReadOnly: staff(45, "laxReadOnly", "lax-readonly@lax.bid", "Ben", "Carter", null),
} as const satisfies Record<string, DemoPerson>;

/** Seeded people from the base demo seed the top-up builds on, by email. */
export const BASE_EMAILS = {
  admin: "admin@lax.bid",
  galleryAdmin: "gallery-admin@lax.bid",
  galleryFinance: "gallery-finance@lax.bid",
  consignor: "consignor@lax.bid",
  viewer: "viewer@lax.bid",
} as const;

/** Seeded accounts the top-up builds on, by slug. */
export const BASE_ENTITY_SLUGS = {
  northbank: "northbank-gallery",
  laxStock: "lax-house-stock",
} as const;
