import { type Static, Type } from "@sinclair/typebox";
import { createCursorListResponseSchema } from "./cursor-list.js";

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
});

export const AdminOrderListSchema = Type.Object({
  items: Type.Array(AdminOrderListItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  /** Matches per status under every active filter except `status`, so the chips add up. */
  counts: Type.Record(Type.String(), Type.Integer()),
});
export type AdminOrderList = Static<typeof AdminOrderListSchema>;

export const AdminFulfilmentListItemSchema = Type.Object({
  fulfilmentId: Type.String({ format: "uuid" }),
  orderId: Type.String({ format: "uuid" }),
  status: Type.String(),
  option: Type.String(),
  carrier: Type.Union([Type.String(), Type.Null()]),
  trackingNumber: Type.Union([Type.String(), Type.Null()]),
  updatedAt: Type.String(),
});

export const AdminFulfilmentListSchema = createCursorListResponseSchema(
  AdminFulfilmentListItemSchema,
);

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
});

export const AdminPayoutListSchema = createCursorListResponseSchema(AdminPayoutListItemSchema);

export const AdminStockHoldListItemSchema = Type.Object({
  holdId: Type.String({ format: "uuid" }),
  editionId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  editionNumber: Type.Integer(),
  status: Type.String(),
  expiresAt: Type.String(),
  brokerPartyId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  clientPartyId: Type.String({ format: "uuid" }),
});

export const AdminStockHoldListSchema = createCursorListResponseSchema(
  AdminStockHoldListItemSchema,
);

export const AdminThirdPartySaleListItemSchema = Type.Object({
  saleId: Type.String({ format: "uuid" }),
  editionId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  editionNumber: Type.Integer(),
  status: Type.String(),
  grossPence: Type.Integer(),
  recordedAt: Type.Union([Type.String(), Type.Null()]),
});

export const AdminThirdPartySaleListSchema = createCursorListResponseSchema(
  AdminThirdPartySaleListItemSchema,
);

export const AdminOriginalSaleListItemSchema = Type.Object({
  saleId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  status: Type.String(),
  salePricePence: Type.Integer(),
  createdAt: Type.String(),
});

export const AdminOriginalSaleListSchema = createCursorListResponseSchema(
  AdminOriginalSaleListItemSchema,
);

export const AdminSaleAuthorityRequestListItemSchema = Type.Object({
  requestId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  ownerPartyId: Type.String({ format: "uuid" }),
  ownerDisplayName: Type.String(),
  requestedCount: Type.Integer(),
  status: Type.String(),
  createdAt: Type.String(),
});

export const AdminSaleAuthorityRequestListSchema = createCursorListResponseSchema(
  AdminSaleAuthorityRequestListItemSchema,
);

export const AdminPartyListItemSchema = Type.Object({
  partyId: Type.String({ format: "uuid" }),
  displayName: Type.String(),
  kind: Type.String(),
  identitySubjectId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const AdminPartyListSchema = createCursorListResponseSchema(AdminPartyListItemSchema);

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

export const AdminArtistListSchema = createCursorListResponseSchema(AdminArtistListItemSchema);
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
  role: Type.String(),
  disabledAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const AdminStaffMemberListSchema = createCursorListResponseSchema(
  AdminStaffMemberListItemSchema,
);
export type AdminStaffMemberList = Static<typeof AdminStaffMemberListSchema>;

/** Each figure is present only when the caller's role may open the list it counts. */
export const AdminOverviewKpisSchema = Type.Object({
  fulfilmentOpenCount: Type.Optional(Type.Integer()),
  payoutsDueCount: Type.Optional(Type.Integer()),
  activeHoldsCount: Type.Optional(Type.Integer()),
  pendingAuthorityRequestsCount: Type.Optional(Type.Integer()),
});

export type AdminOverviewKpis = Static<typeof AdminOverviewKpisSchema>;
