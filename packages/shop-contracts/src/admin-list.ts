import { type Static, Type } from "@sinclair/typebox";
import { AdminWorkListCountsSchema } from "./admin-work-lists.js";
import { createCursorListResponseSchema } from "./cursor-list.js";

const NullableString = Type.Union([Type.String(), Type.Null()]);

/** A work list page: its rows, the next page, and the per-status counts for its views. */
function workListSchema<T extends ReturnType<typeof Type.Object>>(itemSchema: T) {
  return Type.Object({
    items: Type.Array(itemSchema),
    nextCursor: NullableString,
    /** Optional so the admin parses responses from an older shop-api. */
    counts: Type.Optional(AdminWorkListCountsSchema),
  });
}

/** The statuses an order moves through; `status` on the list query takes one of these. */
export const ADMIN_ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "partially_refunded",
  "refunded",
  "payment_failed",
  "cancelled",
  "expired",
] as const;
export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export const ADMIN_ORDER_SEARCH_MAX_LENGTH = 100;
export const ADMIN_ORDER_LIST_MAX_LIMIT = 100;

const OrderStatusSchema = Type.Union(ADMIN_ORDER_STATUSES.map((status) => Type.Literal(status)));
const CalendarDateSchema = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });

/**
 * `createdFrom` and `createdTo` are inclusive calendar days in UK time. `q` matches the start of
 * the order id (what staff see as the order number), the buyer's email or name, and the
 * delivery recipient's name.
 */
export const AdminOrderListQuerySchema = Type.Object({
  status: Type.Optional(OrderStatusSchema),
  createdFrom: Type.Optional(CalendarDateSchema),
  createdTo: Type.Optional(CalendarDateSchema),
  q: Type.Optional(Type.String({ maxLength: ADMIN_ORDER_SEARCH_MAX_LENGTH })),
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: ADMIN_ORDER_LIST_MAX_LIMIT })),
});
export type AdminOrderListQuery = Static<typeof AdminOrderListQuerySchema>;

export const AdminOrderListItemSchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  status: Type.String(),
  totalPence: Type.Integer(),
  fulfilment: Type.String(),
  buyerSubjectId: Type.String(),
  /** From the buyer's profile; null for a buyer who has none. */
  buyerName: Type.Union([Type.String(), Type.Null()]),
  buyerEmail: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  paidAt: Type.Union([Type.String(), Type.Null()]),
  /** "LAX-S-10482"; optional so the admin parses responses from an older shop-api. */
  reference: Type.Optional(Type.String()),
});

export const AdminOrderListSchema = Type.Object({
  items: Type.Array(AdminOrderListItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  /** Matches per status under every active filter except `status`, so the chips add up. */
  counts: Type.Record(Type.String(), Type.Integer()),
});
export type AdminOrderList = Static<typeof AdminOrderListSchema>;

/** A daily series over the summary window, oldest day first, with the window's total and the total of the same number of days before it. */
const AdminDailySeriesSchema = Type.Object({
  daily: Type.Array(Type.Integer({ minimum: 0 })),
  current: Type.Integer({ minimum: 0 }),
  prior: Type.Integer({ minimum: 0 }),
});

/** The orders list's headline numbers: what was paid and how many orders came in, per UK day. */
export const AdminOrderSummarySchema = Type.Object({
  periodDays: Type.Integer({ minimum: 1 }),
  /** Order totals by the day they were paid, in pence. */
  paidPence: AdminDailySeriesSchema,
  /** Orders by the day they were placed. */
  orders: AdminDailySeriesSchema,
  /** Orders by the day they were paid, for the average order value. */
  paidOrders: AdminDailySeriesSchema,
});
export type AdminOrderSummary = Static<typeof AdminOrderSummarySchema>;

export const AdminFulfilmentListItemSchema = Type.Object({
  fulfilmentId: Type.String({ format: "uuid" }),
  orderId: Type.String({ format: "uuid" }),
  status: Type.String(),
  option: Type.String(),
  carrier: Type.Union([Type.String(), Type.Null()]),
  trackingNumber: Type.Union([Type.String(), Type.Null()]),
  updatedAt: Type.String(),
  /* The rest is optional so the admin parses responses from an older shop-api. */
  /** When the customer took possession; it starts their cancellation period. */
  possessionAt: Type.Optional(NullableString),
  /** When the order was paid; possession cannot be recorded before it. */
  paidAt: Type.Optional(NullableString),
  buyerName: Type.Optional(NullableString),
  buyerEmail: Type.Optional(NullableString),
  /** The order's reference, "LAX-S-10482". */
  orderReference: Type.Optional(Type.String()),
});

export const AdminFulfilmentListSchema = workListSchema(AdminFulfilmentListItemSchema);

export const AdminPayoutListItemSchema = Type.Object({
  payoutId: Type.String({ format: "uuid" }),
  ownerPartyId: Type.String({ format: "uuid" }),
  ownerDisplayName: Type.String(),
  source: Type.String(),
  grossPence: Type.Integer(),
  deductionsPence: Type.Integer(),
  netPence: Type.Integer(),
  status: Type.String(),
  payoutDueAt: Type.String(),
  paidAt: Type.Union([Type.String(), Type.Null()]),
  /** The bank or transfer reference staff entered when paying; optional for older shop-api. */
  paidReference: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.Optional(Type.String()),
});

export const AdminPayoutListSchema = workListSchema(AdminPayoutListItemSchema);

export const AdminStockHoldListItemSchema = Type.Object({
  holdId: Type.String({ format: "uuid" }),
  editionId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  editionNumber: Type.Integer(),
  status: Type.String(),
  expiresAt: Type.String(),
  brokerPartyId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  clientPartyId: Type.String({ format: "uuid" }),
  /* The rest is optional so the admin parses responses from an older shop-api. */
  clientName: Type.Optional(Type.String()),
  brokerName: Type.Optional(NullableString),
  note: Type.Optional(NullableString),
  createdAt: Type.Optional(Type.String()),
});

export const AdminStockHoldListSchema = workListSchema(AdminStockHoldListItemSchema);

export const AdminThirdPartySaleListItemSchema = Type.Object({
  saleId: Type.String({ format: "uuid" }),
  editionId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  editionNumber: Type.Integer(),
  status: Type.String(),
  grossPence: Type.Integer(),
  recordedAt: Type.Union([Type.String(), Type.Null()]),
  /** The fees on the sale, so a fee is approved from its sale. Optional for older shop-api. */
  fees: Type.Optional(
    Type.Array(
      Type.Object({
        feeId: Type.String({ format: "uuid" }),
        label: Type.String(),
        amountPence: Type.Integer(),
        status: Type.String(),
      }),
    ),
  ),
  /* The rest is optional so the admin parses responses from an older shop-api. */
  sellerName: Type.Optional(Type.String()),
  buyerName: Type.Optional(Type.String()),
  createdAt: Type.Optional(Type.String()),
});

export const AdminThirdPartySaleListSchema = workListSchema(AdminThirdPartySaleListItemSchema);

export const AdminOriginalSaleListItemSchema = Type.Object({
  saleId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  status: Type.String(),
  salePricePence: Type.Integer(),
  createdAt: Type.String(),
  /** The buyer, so the invoice is addressed from the sale. Optional for older shop-api. */
  buyerName: Type.Optional(Type.String()),
  buyerEmail: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  /** When an uninvoiced reservation lapses; null holds it until it is invoiced. */
  reservationExpiresAt: Type.Optional(NullableString),
});

export const AdminOriginalSaleListSchema = workListSchema(AdminOriginalSaleListItemSchema);

export const AdminSaleAuthorityRequestListItemSchema = Type.Object({
  requestId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  ownerPartyId: Type.String({ format: "uuid" }),
  ownerDisplayName: Type.String(),
  requestedCount: Type.Integer(),
  status: Type.String(),
  createdAt: Type.String(),
  /* The rest is optional so the admin parses responses from an older shop-api. */
  /** What the seller wrote with the request. */
  note: Type.Optional(NullableString),
  /** Why LAX declined it, as the seller sees it. */
  declineReason: Type.Optional(NullableString),
  handledAt: Type.Optional(NullableString),
});

export const AdminSaleAuthorityRequestListSchema = workListSchema(
  AdminSaleAuthorityRequestListItemSchema,
);

export const AdminPartyListItemSchema = Type.Object({
  partyId: Type.String({ format: "uuid" }),
  displayName: Type.String(),
  kind: Type.String(),
  identitySubjectId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  /* The rest is optional so the admin parses responses from an older shop-api. */
  /** From the client's LAX profile; null for a client without one. */
  email: Type.Optional(NullableString),
  /** Editions they own now. */
  editionCount: Type.Optional(Type.Integer({ minimum: 0 })),
  /** Shop orders they have paid for. */
  paidOrderCount: Type.Optional(Type.Integer({ minimum: 0 })),
});

/** Counts are per client kind, under the search but not the kind. */
export const AdminPartyListSchema = workListSchema(AdminPartyListItemSchema);

export const AdminArtistListItemSchema = Type.Object({
  artistId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  displayName: Type.String(),
  discipline: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  /** Optional so the admin parses responses from an older shop-api. */
  archived: Type.Optional(Type.Boolean()),
  artworkCount: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const AdminArtistListSchema = Type.Intersect([
  createCursorListResponseSchema(AdminArtistListItemSchema),
  Type.Object({
    /** Matches per status under the search, for the view tabs. Optional for an older shop-api. */
    counts: Type.Optional(
      Type.Object({
        active: Type.Integer({ minimum: 0 }),
        archived: Type.Integer({ minimum: 0 }),
      }),
    ),
  }),
]);
export type AdminArtistList = Static<typeof AdminArtistListSchema>;
export type AdminArtistListItem = Static<typeof AdminArtistListItemSchema>;

export const AdminStaffMemberListItemSchema = Type.Object({
  staffMemberId: Type.String({ format: "uuid" }),
  identitySubjectId: Type.String(),
  /** From the person's LAX profile; null until they have signed in to a LAX product. */
  displayName: Type.Union([Type.String(), Type.Null()]),
  email: Type.Union([Type.String(), Type.Null()]),
  /** Their latest recorded admin action, as a proxy for last active; null if none. */
  lastActiveAt: Type.Union([Type.String(), Type.Null()]),
  /** The primary role, for places with room for one. */
  role: Type.String(),
  /** Every role held or starting later, with its period; capabilities are their union. */
  roles: Type.Array(
    Type.Object({
      role: Type.String(),
      startsAt: Type.String(),
      endsAt: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
  disabledAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

/** Counts are per status (active, disabled), under the search and role but not the status. */
export const AdminStaffMemberListSchema = workListSchema(AdminStaffMemberListItemSchema);
export type AdminStaffMemberList = Static<typeof AdminStaffMemberListSchema>;

/** Each figure is present only when the caller's role may open the list it counts. */
export const AdminOverviewKpisSchema = Type.Object({
  fulfilmentOpenCount: Type.Optional(Type.Integer()),
  payoutsDueCount: Type.Optional(Type.Integer()),
  activeHoldsCount: Type.Optional(Type.Integer()),
  pendingAuthorityRequestsCount: Type.Optional(Type.Integer()),
  /**
   * Live open editions with 3 or fewer prints on sale, for staff who can add prints. Absent for
   * everyone else, and from an older shop-api.
   */
  lowStockRuns: Type.Optional(
    Type.Array(
      Type.Object({
        artworkId: Type.String({ format: "uuid" }),
        title: Type.String(),
        onSale: Type.Integer({ minimum: 0 }),
      }),
    ),
  ),
});

export type AdminOverviewKpis = Static<typeof AdminOverviewKpisSchema>;

export type AdminFulfilmentList = Static<typeof AdminFulfilmentListSchema>;
export type AdminPayoutList = Static<typeof AdminPayoutListSchema>;
export type AdminStockHoldList = Static<typeof AdminStockHoldListSchema>;
export type AdminThirdPartySaleList = Static<typeof AdminThirdPartySaleListSchema>;
export type AdminOriginalSaleList = Static<typeof AdminOriginalSaleListSchema>;
export type AdminSaleAuthorityRequestList = Static<typeof AdminSaleAuthorityRequestListSchema>;
export type AdminPartyList = Static<typeof AdminPartyListSchema>;
