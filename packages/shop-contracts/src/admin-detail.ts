import { type Static, Type } from "@sinclair/typebox";

export const AdminClientPartySchema = Type.Object({
  partyId: Type.String({ format: "uuid" }),
  displayName: Type.String(),
  kind: Type.String(),
  identitySubjectId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  /** From the client's LAX profile; optional for responses from an older shop-api. */
  email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

/** A Shop order the client placed, newest first. */
export const AdminClientOrderSchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  status: Type.String(),
  totalPence: Type.Integer(),
  lineCount: Type.Integer({ minimum: 0 }),
  createdAt: Type.String(),
  paidAt: Type.Union([Type.String(), Type.Null()]),
  /** "LAX-S-10482"; optional for responses from an older shop-api. */
  reference: Type.Optional(Type.String()),
});

/** An enquiry the client sent from the Shop or lax.art: about an artwork, or a general one. */
export const AdminClientEnquirySchema = Type.Object({
  enquiryId: Type.String({ format: "uuid" }),
  kind: Type.Union([Type.Literal("artwork"), Type.Literal("general")]),
  /** The artwork's title for an artwork enquiry; the topic code for a general one. */
  subject: Type.String(),
  status: Type.String(),
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
  /* The rest is optional so the admin parses responses from an older shop-api. */
  orders: Type.Optional(Type.Array(AdminClientOrderSchema)),
  /** Orders placed in all, beyond the newest ones listed. */
  orderCount: Type.Optional(Type.Integer({ minimum: 0 })),
  enquiries: Type.Optional(Type.Array(AdminClientEnquirySchema)),
  /** Every captured Shop payment less what has been refunded; pending payments never count. */
  paidToDatePence: Type.Optional(Type.Integer()),
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
  /** When the customer took possession; null until recorded. Optional for older shop-api. */
  possessionAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
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
  /** "LAX-S-10482"; optional for responses from an older shop-api. */
  reference: Type.Optional(Type.String()),
  status: Type.String(),
  fulfilment: Type.String(),
  totalPence: Type.Integer(),
  buyerSubjectId: Type.String(),
  /** From the buyer's profile; null for a buyer who has none. */
  buyerName: Type.Union([Type.String(), Type.Null()]),
  buyerEmail: Type.Union([Type.String(), Type.Null()]),
  /** True while the order belongs to a guest checkout rather than a LAX account. */
  buyerIsGuest: Type.Optional(Type.Boolean()),
  /** The guest who placed it, kept after a claim; null for an account's own checkout. */
  guestCustomerId: Type.Optional(Type.Union([Type.String({ format: "uuid" }), Type.Null()])),
  /** When the guest's personal data was erased on request; the order itself is kept. */
  personalDataErasedAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  /**
   * The name and address an erased guest's VAT invoice shows, kept for the accounting record.
   * Sent only to staff who handle invoices; null otherwise and once purged.
   */
  retainedInvoiceContact: Type.Optional(
    Type.Union([
      Type.Object({
        name: Type.Union([Type.String(), Type.Null()]),
        addressLines: Type.Array(Type.String()),
      }),
      Type.Null(),
    ]),
  ),
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
/** Evidence note on an approval and reason on a decline of a sale-authority request. */
export const SALE_AUTHORITY_NOTE_MAX_LENGTH = 1000;
export const FULFILMENT_CARRIER_MAX_LENGTH = 80;
export const FULFILMENT_TRACKING_NUMBER_MAX_LENGTH = 64;
/**
 * A tracking number goes into a customer email and a carrier link, so it is letters, digits,
 * spaces and hyphens, starting with a letter or digit.
 */
export const FULFILMENT_TRACKING_NUMBER_PATTERN = "^[A-Za-z0-9][A-Za-z0-9 -]*$";
export const PAYOUT_PAID_REFERENCE_MAX_LENGTH = 120;

export type AdminClientDetail = Static<typeof AdminClientDetailSchema>;
export type AdminArtistDetail = Static<typeof AdminArtistDetailSchema>;
export type AdminOrderDetail = Static<typeof AdminOrderDetailSchema>;
export type AdminOrderActivity = Static<typeof AdminOrderActivitySchema>;
