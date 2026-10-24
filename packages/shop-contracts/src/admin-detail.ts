import { type Static, Type } from "@sinclair/typebox";

export const AdminClientPartySchema = Type.Object({
  partyId: Type.String({ format: "uuid" }),
  displayName: Type.String(),
  kind: Type.String(),
  identitySubjectId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const AdminClientEditionSchema = Type.Object({
  editionId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  editionNumber: Type.Integer(),
  listingStatus: Type.String(),
  custodyStatus: Type.String(),
});

export const AdminClientSaleAuthoritySchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  authorisedCount: Type.Integer(),
  committedCount: Type.Integer(),
  lastGrantAt: Type.Union([Type.String(), Type.Null()]),
});

export const AdminClientSaleAuthorityRequestSchema = Type.Object({
  requestId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  requestedCount: Type.Integer(),
  status: Type.String(),
  createdAt: Type.String(),
});

export const AdminClientPayoutSchema = Type.Object({
  payoutId: Type.String({ format: "uuid" }),
  source: Type.String(),
  grossPence: Type.Integer(),
  netPence: Type.Integer(),
  status: Type.String(),
  payoutDueAt: Type.String(),
  paidAt: Type.Union([Type.String(), Type.Null()]),
});

export const AdminClientDetailSchema = Type.Object({
  party: AdminClientPartySchema,
  editions: Type.Array(AdminClientEditionSchema),
  saleAuthority: Type.Array(AdminClientSaleAuthoritySchema),
  requests: Type.Array(AdminClientSaleAuthorityRequestSchema),
  payouts: Type.Array(AdminClientPayoutSchema),
});

export const AdminArtistSummarySchema = Type.Object({
  artistId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  displayName: Type.String(),
  discipline: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  seoTitle: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  seoDescription: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  archived: Type.Optional(Type.Boolean()),
});

export const AdminArtistArtworkSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  title: Type.String(),
  saleState: Type.String(),
  /** live, draft, sold_out or archived; optional for responses from an older shop-api. */
  state: Type.Optional(Type.String()),
});

export const AdminArtistEditionSchema = Type.Object({
  editionId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkTitle: Type.String(),
  editionNumber: Type.Integer(),
  listingStatus: Type.String(),
  ownerPartyId: Type.String({ format: "uuid" }),
  ownerDisplayName: Type.String(),
});

export const AdminArtistSaleSchema = Type.Object({
  saleId: Type.String({ format: "uuid" }),
  channel: Type.String(),
  artworkTitle: Type.String(),
  editionNumber: Type.Union([Type.Integer(), Type.Null()]),
  grossPence: Type.Integer(),
  payeeDisplayName: Type.String(),
  occurredAt: Type.Union([Type.String(), Type.Null()]),
});

export const AdminArtistDetailSchema = Type.Object({
  artist: AdminArtistSummarySchema,
  artworks: Type.Array(AdminArtistArtworkSchema),
  editions: Type.Array(AdminArtistEditionSchema),
  sales: Type.Array(AdminArtistSaleSchema),
});

export const AdminOrderLineDetailSchema = Type.Object({
  orderLineId: Type.String({ format: "uuid" }),
  artworkId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  artworkTitle: Type.Union([Type.String(), Type.Null()]),
  productTitle: Type.Union([Type.String(), Type.Null()]),
  sku: Type.Union([Type.String(), Type.Null()]),
  editionNumber: Type.Union([Type.Integer(), Type.Null()]),
  unitPricePence: Type.Integer(),
  sellerPartyId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  /** The edition sold on this line; null for merchandise. */
  editionId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  /** The latest production task for this line, when one exists. */
  production: Type.Union([
    Type.Object({ taskId: Type.String({ format: "uuid" }), status: Type.String() }),
    Type.Null(),
  ]),
});

export const AdminOrderFulfilmentDetailSchema = Type.Object({
  fulfilmentId: Type.String({ format: "uuid" }),
  status: Type.String(),
  option: Type.String(),
  carrier: Type.Union([Type.String(), Type.Null()]),
  trackingNumber: Type.Union([Type.String(), Type.Null()]),
  updatedAt: Type.String(),
});

export const AdminOrderRefundDetailSchema = Type.Object({
  refundId: Type.String({ format: "uuid" }),
  orderLineId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  amountPence: Type.Integer(),
  status: Type.String(),
  source: Type.String(),
  createdAt: Type.String(),
});

/**
 * A staff action on the order or one of its records (refund, fulfilment, production task), from
 * the admin audit log, for the order's timeline. `detail` is the recorded after-state, when kept.
 */
export const AdminOrderActivitySchema = Type.Object({
  auditId: Type.String({ format: "uuid" }),
  action: Type.String(),
  targetType: Type.String(),
  actorSubjectId: Type.String(),
  actorName: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  detail: Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()]),
});

export const AdminOrderDetailSchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  status: Type.String(),
  fulfilment: Type.String(),
  totalPence: Type.Integer(),
  buyerSubjectId: Type.String(),
  /** From the buyer's profile; null for a buyer who has none. */
  buyerName: Type.Union([Type.String(), Type.Null()]),
  buyerEmail: Type.Union([Type.String(), Type.Null()]),
  stripeCheckoutSessionId: Type.Union([Type.String(), Type.Null()]),
  stripePaymentIntentId: Type.Union([Type.String(), Type.Null()]),
  paidAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  lines: Type.Array(AdminOrderLineDetailSchema),
  fulfilmentRecord: Type.Union([AdminOrderFulfilmentDetailSchema, Type.Null()]),
  refunds: Type.Array(AdminOrderRefundDetailSchema),
  /** Newest first. */
  activity: Type.Array(AdminOrderActivitySchema),
});

/**
 * Why staff refund an order. Recorded with the refund in the audit log and shown on the order's
 * timeline; it does not change how the payment provider processes the refund.
 */
export const ADMIN_REFUND_REASONS = [
  "customer_request",
  "damaged_in_transit",
  "not_as_described",
  "duplicate_payment",
  "goodwill",
  "other",
] as const;
export type AdminRefundReason = (typeof ADMIN_REFUND_REASONS)[number];
export const ADMIN_REFUND_NOTE_MAX_LENGTH = 500;

export type AdminClientDetail = Static<typeof AdminClientDetailSchema>;
export type AdminArtistDetail = Static<typeof AdminArtistDetailSchema>;
export type AdminOrderDetail = Static<typeof AdminOrderDetailSchema>;
export type AdminOrderActivity = Static<typeof AdminOrderActivitySchema>;
