import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
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

/** Separate legal businesses: LAX Bid is London Auction Xchange LTD; LAX Shop and lax.art are London Art Exchange Ltd. */
export const LAX_BUSINESS_KEYS = ["lax_bid", "lax_art"] as const;
export type LaxBusinessKey = (typeof LAX_BUSINESS_KEYS)[number];

export const LaxBusinessV1 = Type.Object({
  key: stringEnum(LAX_BUSINESS_KEYS),
  legalName: Type.String({ minLength: 1 }),
});
export type LaxBusinessV1 = Static<typeof LaxBusinessV1>;

/**
 * `awaiting_payment`: owed and not yet paid. `payment_confirming`: the buyer has paid and the
 * payment is still being confirmed, so it is neither owed nor paid yet.
 */
export const LAX_PORTFOLIO_ITEM_STATUSES = [
  "awaiting_payment",
  "payment_confirming",
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
  /** What a seller receives with a payout: the settled sales and the fees taken. */
  "payout_statement",
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
  /**
   * What the product calls this document when it can say more than its kind does, such as
   * "Certificate of authenticity No. 7/24". A consumer falls back to the kind's name without it.
   */
  label: Type.Optional(Type.String({ minLength: 1 })),
});
export type LaxPortfolioDocumentV1 = Static<typeof LaxPortfolioDocumentV1>;

export const LaxPortfolioActionV1 = Type.Object({
  kind: stringEnum(LAX_PORTFOLIO_ACTION_KINDS),
  href: Type.String({ minLength: 1 }),
});
export type LaxPortfolioActionV1 = Static<typeof LaxPortfolioActionV1>;

export const LAX_OWED_STATES = ["due", "in_review", "still_to_send"] as const;
export type LaxOwedState = (typeof LAX_OWED_STATES)[number];

export const LAX_OWED_BLOCKERS = ["documents", "review"] as const;
export type LaxOwedBlocker = (typeof LAX_OWED_BLOCKERS)[number];

/**
 * What the buyer still owes on a work that is awaiting payment: the total one payment covers
 * (hammer and premium), so the same figure appears here, in the product and in its invoice.
 * `in_review` means the buyer's account is held for checks and cannot pay yet; `blocker` says
 * whether the buyer can act (`documents`) or is waiting on LAX (`review`). `still_to_send`
 * means a bank transfer has delivered part of the payment: `amount` is this work's share of what
 * is left to send, and nothing is paid until all of it arrives.
 */
export const LaxPortfolioOwedV1 = Type.Object({
  amount: minorUnitsSchema,
  currency: currencySchema,
  state: stringEnum(LAX_OWED_STATES),
  blocker: Type.Optional(stringEnum(LAX_OWED_BLOCKERS)),
});
export type LaxPortfolioOwedV1 = Static<typeof LaxPortfolioOwedV1>;

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
  /** Present on a work awaiting payment when the product knows the amount due. */
  owed: Type.Optional(LaxPortfolioOwedV1),
  /**
   * Which print of a limited edition this is, as the product describes it to the owner:
   * "No. 7 of 24 · Hand-signed". Present only for a work that has an edition to describe.
   */
  edition: Type.Optional(Type.String({ minLength: 1 })),
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
  /**
   * Set on an amount owed that is the rest of a part-funded bank transfer, so the ledger can say
   * "still to send" rather than "owed".
   */
  stillToSend: Type.Optional(Type.Boolean()),
  /**
   * The product the money belongs to. LAX Shop and lax.art share one business, so the business
   * cannot say it. Optional so payloads from before the field stay valid; a consumer falls back
   * to the business's default product (see `moneyProductOf`).
   */
  product: Type.Optional(stringEnum(LAX_PRODUCT_IDS)),
});
export type LaxMoneyEntryV1 = Static<typeof LaxMoneyEntryV1>;

/**
 * Response of a product's portfolio route. `partial` is set when the product deliberately left
 * part of its data out (a disabled feature, say): `items` is then incomplete rather than empty,
 * and a consumer must not present it as the whole portfolio.
 */
export const LaxPortfolioResponseV1 = Type.Object({
  items: Type.Array(LaxPortfolioItemV1),
  partial: Type.Optional(Type.Boolean()),
});
export type LaxPortfolioResponseV1 = Static<typeof LaxPortfolioResponseV1>;

/** Response of a product's money route; `partial` carries the same meaning as on the portfolio. */
export const LaxMoneyResponseV1 = Type.Object({
  entries: Type.Array(LaxMoneyEntryV1),
  partial: Type.Optional(Type.Boolean()),
});
export type LaxMoneyResponseV1 = Static<typeof LaxMoneyResponseV1>;

/**
 * Validates a product's response body against the contract. A consumer that renders money must
 * not trust a body that only looks right, so anything off-contract is null rather than coerced.
 */
export function parseLaxPortfolioResponse(body: unknown): LaxPortfolioResponseV1 | null {
  return Value.Check(LaxPortfolioResponseV1, body) ? body : null;
}

export function parseLaxMoneyResponse(body: unknown): LaxMoneyResponseV1 | null {
  return Value.Check(LaxMoneyResponseV1, body) ? body : null;
}
