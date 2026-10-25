import { type Static, type TLiteral, Type } from "@sinclair/typebox";

/*
 * The staff work lists for sales and operations: fulfilment, payouts, stock holds, third-party
 * and original sales, sale limit requests and disputes. Each takes the same query: a status (the
 * list's views), a search, a sort and a keyset cursor. Each sort orders by one column with the
 * record id as the tiebreaker, so paging never skips or repeats a row. A cursor is only valid
 * under the sort and filters it was issued for.
 */

export const ADMIN_WORK_LIST_SEARCH_MAX_LENGTH = 100;
export const ADMIN_WORK_LIST_MAX_LIMIT = 100;

function literals<const T extends readonly string[]>(values: T) {
  return Type.Union(values.map((value) => Type.Literal(value)) as TLiteral<T[number]>[]);
}

const CursorSchema = Type.Optional(Type.String({ maxLength: 512 }));
const LimitSchema = Type.Optional(Type.Integer({ minimum: 1, maximum: ADMIN_WORK_LIST_MAX_LIMIT }));
const SearchSchema = Type.Optional(Type.String({ maxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH }));

/** Rows per status under every filter except status, so the view counts add up. */
export const AdminWorkListCountsSchema = Type.Record(Type.String(), Type.Integer({ minimum: 0 }));
export type AdminWorkListCounts = Static<typeof AdminWorkListCountsSchema>;

// Statuses ---------------------------------------------------------------------------------

export const ADMIN_FULFILMENT_STATUSES = [
  "pending_production",
  "in_production",
  "awaiting_dispatch",
  "in_transit",
  "ready_for_collection",
  "collected",
  "in_storage",
  "delivered",
  "cancelled",
] as const;
export type AdminFulfilmentStatus = (typeof ADMIN_FULFILMENT_STATUSES)[number];

/** Fulfilments with work left to do; the rest are delivered, collected, stored or cancelled. */
export const ADMIN_FULFILMENT_OPEN_STATUSES = [
  "pending_production",
  "in_production",
  "awaiting_dispatch",
  "in_transit",
  "ready_for_collection",
] as const satisfies readonly AdminFulfilmentStatus[];

export const ADMIN_FULFILMENT_OPTIONS = [
  "uk_insured_delivery",
  "collect_new_cavendish",
  "collect_brunswick",
  "lax_storage",
  "international_quotation",
] as const;
export type AdminFulfilmentOption = (typeof ADMIN_FULFILMENT_OPTIONS)[number];

export const ADMIN_PAYOUT_STATUSES = ["pending_refund_period", "due", "paid", "cancelled"] as const;
export type AdminPayoutStatus = (typeof ADMIN_PAYOUT_STATUSES)[number];

export const ADMIN_PAYOUT_SOURCES = ["order_line", "third_party_sale", "original_sale"] as const;
export type AdminPayoutSource = (typeof ADMIN_PAYOUT_SOURCES)[number];

export const ADMIN_STOCK_HOLD_STATUSES = ["active", "released", "expired", "converted"] as const;
export type AdminStockHoldStatus = (typeof ADMIN_STOCK_HOLD_STATUSES)[number];

export const ADMIN_THIRD_PARTY_SALE_STATUSES = ["draft", "recorded", "cancelled"] as const;
export type AdminThirdPartySaleStatus = (typeof ADMIN_THIRD_PARTY_SALE_STATUSES)[number];

export const ADMIN_ORIGINAL_SALE_STATUSES = [
  "reserved",
  "deposit_due",
  "invoiced",
  "paid",
  "assigned",
  "cancelled",
] as const;
export type AdminOriginalSaleStatus = (typeof ADMIN_ORIGINAL_SALE_STATUSES)[number];

export const ADMIN_SALE_AUTHORITY_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type AdminSaleAuthorityRequestStatus =
  (typeof ADMIN_SALE_AUTHORITY_REQUEST_STATUSES)[number];

export const ADMIN_DISPUTE_STATUSES = ["opened", "won", "lost", "closed"] as const;
export type AdminDisputeStatus = (typeof ADMIN_DISPUTE_STATUSES)[number];

// Sorts: the first of each list is the default ----------------------------------------------

export const ADMIN_FULFILMENT_SORTS = ["updated_desc", "updated_asc"] as const;
export const ADMIN_PAYOUT_SORTS = ["due_asc", "due_desc", "created_desc", "created_asc"] as const;
export const ADMIN_STOCK_HOLD_SORTS = [
  "created_desc",
  "created_asc",
  "expires_asc",
  "expires_desc",
] as const;
export const ADMIN_THIRD_PARTY_SALE_SORTS = ["created_desc", "created_asc"] as const;
export const ADMIN_ORIGINAL_SALE_SORTS = ["created_desc", "created_asc"] as const;
export const ADMIN_SALE_AUTHORITY_REQUEST_SORTS = ["created_desc", "created_asc"] as const;
export const ADMIN_DISPUTE_SORTS = ["opened_desc", "opened_asc"] as const;

export type AdminFulfilmentSort = (typeof ADMIN_FULFILMENT_SORTS)[number];
export type AdminPayoutSort = (typeof ADMIN_PAYOUT_SORTS)[number];
export type AdminStockHoldSort = (typeof ADMIN_STOCK_HOLD_SORTS)[number];
export type AdminThirdPartySaleSort = (typeof ADMIN_THIRD_PARTY_SALE_SORTS)[number];
export type AdminOriginalSaleSort = (typeof ADMIN_ORIGINAL_SALE_SORTS)[number];
export type AdminSaleAuthorityRequestSort = (typeof ADMIN_SALE_AUTHORITY_REQUEST_SORTS)[number];
export type AdminDisputeSort = (typeof ADMIN_DISPUTE_SORTS)[number];

// Queries ----------------------------------------------------------------------------------

/**
 * `stage=open` keeps fulfilments with work left to do and `stage=done` the finished ones; a
 * `status` narrows further. `q` matches the start of the order number, the tracking number and
 * the buyer's name or email.
 */
export const AdminFulfilmentListQuerySchema = Type.Object({
  stage: Type.Optional(literals(["open", "done"] as const)),
  status: Type.Optional(literals(ADMIN_FULFILMENT_STATUSES)),
  option: Type.Optional(literals(ADMIN_FULFILMENT_OPTIONS)),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_FULFILMENT_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminFulfilmentListQuery = Static<typeof AdminFulfilmentListQuerySchema>;

/** `q` matches the payee's name or the start of the payout reference. */
export const AdminPayoutListQuerySchema = Type.Object({
  status: Type.Optional(literals(ADMIN_PAYOUT_STATUSES)),
  source: Type.Optional(literals(ADMIN_PAYOUT_SOURCES)),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_PAYOUT_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminPayoutListQuery = Static<typeof AdminPayoutListQuerySchema>;

/** `q` matches the artwork title and the client's name. */
export const AdminStockHoldListQuerySchema = Type.Object({
  status: Type.Optional(literals(ADMIN_STOCK_HOLD_STATUSES)),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_STOCK_HOLD_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminStockHoldListQuery = Static<typeof AdminStockHoldListQuerySchema>;

/** `fee=pending` keeps sales with a fee still waiting for approval. */
export const AdminThirdPartySaleListQuerySchema = Type.Object({
  status: Type.Optional(literals(ADMIN_THIRD_PARTY_SALE_STATUSES)),
  fee: Type.Optional(Type.Literal("pending")),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_THIRD_PARTY_SALE_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminThirdPartySaleListQuery = Static<typeof AdminThirdPartySaleListQuerySchema>;

/** `q` matches the artwork title and the buyer's name or email. */
export const AdminOriginalSaleListQuerySchema = Type.Object({
  status: Type.Optional(literals(ADMIN_ORIGINAL_SALE_STATUSES)),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_ORIGINAL_SALE_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminOriginalSaleListQuery = Static<typeof AdminOriginalSaleListQuerySchema>;

/** `q` matches the artwork title and the owner's name. */
export const AdminSaleAuthorityRequestListQuerySchema = Type.Object({
  status: Type.Optional(literals(ADMIN_SALE_AUTHORITY_REQUEST_STATUSES)),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_SALE_AUTHORITY_REQUEST_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminSaleAuthorityRequestListQuery = Static<
  typeof AdminSaleAuthorityRequestListQuerySchema
>;

/** `q` matches the start of the order number and the dispute reference. */
export const AdminDisputeListQuerySchema = Type.Object({
  status: Type.Optional(literals(ADMIN_DISPUTE_STATUSES)),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_DISPUTE_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminDisputeListQuery = Static<typeof AdminDisputeListQuerySchema>;
