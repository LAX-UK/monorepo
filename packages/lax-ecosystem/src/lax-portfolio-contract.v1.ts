import { type Static, Type } from "@sinclair/typebox";
import { LAX_PRODUCT_IDS } from "./product-directory.js";

/**
 * Read contract every LAX product implements for its own holdings and money.
 *
 * Products own their data and the meaning of their statuses; the Account BFF only composes
 * what they return. The shape is versioned: additive, optional fields stay in V1, anything
 * that changes the meaning or removes a field ships as V2 next to V1 (see the package README).
 */
export const LAX_PORTFOLIO_CONTRACT_VERSION = 1 as const;

/** A string union that keeps its literal type under `Static` (a mapped `Type.Union` widens to string). */
const stringEnum = <const T extends readonly string[]>(values: T) =>
  Type.Unsafe<T[number]>(Type.Union(values.map((value) => Type.Literal(value))));

/** ISO 4217 alphabetic code, upper case. */
const currencySchema = Type.String({ pattern: "^[A-Z]{3}$" });

/**
 * ISO 8601 date-time with an explicit offset. A pattern rather than TypeBox's `date-time`
 * format, which only validates once a format is registered in every consuming process.
 */
const isoDateTimeSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$",
});

/** Integer minor units (pence, cents). Never a float, so sums stay exact. */
const minorUnitsSchema = Type.Integer({ minimum: 0 });

/** Separate legal businesses; LAX Shop trades under LAX Art. */
export const LAX_BUSINESS_KEYS = ["lax_bid", "lax_art"] as const;
export type LaxBusinessKey = (typeof LAX_BUSINESS_KEYS)[number];

export const LaxBusinessV1 = Type.Object({
  key: stringEnum(LAX_BUSINESS_KEYS),
  legalName: Type.String({ minLength: 1 }),
});
export type LaxBusinessV1 = Static<typeof LaxBusinessV1>;

export const LAX_PORTFOLIO_ITEM_STATUSES = [
  "awaiting_payment",
  "awaiting_shipment",
  "owned",
  "consigned",
  "in_sale",
  "sold",
  "payout_pending",
  "payout_paid",
] as const;
export type LaxPortfolioItemStatus = (typeof LAX_PORTFOLIO_ITEM_STATUSES)[number];

export const LAX_COST_LINE_KINDS = [
  "hammer",
  "premium",
  "vat",
  "fees",
  "shipping",
  "price",
] as const;
export type LaxCostLineKind = (typeof LAX_COST_LINE_KINDS)[number];

export const LAX_DOCUMENT_KINDS = [
  "invoice",
  "certificate",
  "provenance",
  "condition_report",
  "insurance_schedule",
] as const;
export type LaxDocumentKind = (typeof LAX_DOCUMENT_KINDS)[number];

export const LAX_PORTFOLIO_ACTION_KINDS = [
  "pay",
  "track_shipping",
  "consign",
  "resell",
  "contact",
  "view",
] as const;
export type LaxPortfolioActionKind = (typeof LAX_PORTFOLIO_ACTION_KINDS)[number];

export const LaxCostLineV1 = Type.Object({
  kind: stringEnum(LAX_COST_LINE_KINDS),
  amount: minorUnitsSchema,
  currency: currencySchema,
});
export type LaxCostLineV1 = Static<typeof LaxCostLineV1>;

export const LaxPortfolioDocumentV1 = Type.Object({
  kind: stringEnum(LAX_DOCUMENT_KINDS),
  available: Type.Boolean(),
  /** Present only when `available`: a deep link into the owning product. */
  href: Type.Optional(Type.String({ minLength: 1 })),
  /** Plain-language note on when a missing document arrives. */
  expectedNote: Type.Optional(Type.String({ minLength: 1 })),
});
export type LaxPortfolioDocumentV1 = Static<typeof LaxPortfolioDocumentV1>;

export const LaxPortfolioActionV1 = Type.Object({
  kind: stringEnum(LAX_PORTFOLIO_ACTION_KINDS),
  href: Type.String({ minLength: 1 }),
});
export type LaxPortfolioActionV1 = Static<typeof LaxPortfolioActionV1>;

export const LaxPortfolioItemV1 = Type.Object({
  product: stringEnum(LAX_PRODUCT_IDS),
  id: Type.String({ minLength: 1 }),
  title: Type.String(),
  artist: Type.String(),
  image: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  acquiredAt: isoDateTimeSchema,
  status: stringEnum(LAX_PORTFOLIO_ITEM_STATUSES),
  paid: Type.Object({ lines: Type.Array(LaxCostLineV1) }),
  documents: Type.Array(LaxPortfolioDocumentV1),
  actions: Type.Array(LaxPortfolioActionV1),
  business: LaxBusinessV1,
});
export type LaxPortfolioItemV1 = Static<typeof LaxPortfolioItemV1>;

export const LAX_MONEY_DIRECTIONS = [
  "owed_by_you",
  "owed_to_you",
  "paid",
  "refunded",
  "fee",
] as const;
export type LaxMoneyDirection = (typeof LAX_MONEY_DIRECTIONS)[number];

export const LAX_MONEY_STATUSES = ["pending", "completed", "cancelled"] as const;
export type LaxMoneyStatus = (typeof LAX_MONEY_STATUSES)[number];

export const LaxMoneyEntryV1 = Type.Object({
  /** Stable within the owning product; lets the ledger key and de-duplicate rows. */
  id: Type.String({ minLength: 1 }),
  business: LaxBusinessV1,
  direction: stringEnum(LAX_MONEY_DIRECTIONS),
  status: stringEnum(LAX_MONEY_STATUSES),
  amount: minorUnitsSchema,
  currency: currencySchema,
  occurredAt: isoDateTimeSchema,
  /** Deep link to the product's invoice or payout page. */
  href: Type.String({ minLength: 1 }),
});
export type LaxMoneyEntryV1 = Static<typeof LaxMoneyEntryV1>;
