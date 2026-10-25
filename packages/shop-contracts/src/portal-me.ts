import { type Static, Type } from "@sinclair/typebox";

export const PortalEditionSchema = Type.Object({
  editionId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  editionNumber: Type.Integer(),
  listingStatus: Type.String(),
  custodyStatus: Type.String(),
});

export const PortalEditionsResponseSchema = Type.Object({
  items: Type.Array(PortalEditionSchema),
});

export const PortalSaleAuthoritySchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  ownerPartyId: Type.String({ format: "uuid" }),
  authorisedCount: Type.Integer(),
  committedCount: Type.Integer(),
  lastGrantAt: Type.Union([Type.String(), Type.Null()]),
});

export const PortalSaleAuthorityResponseSchema = Type.Object({
  items: Type.Array(PortalSaleAuthoritySchema),
});

export const SaleAuthorityRequestBodySchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  requestedCount: Type.Integer({ minimum: 0, maximum: 10 }),
  note: Type.Optional(Type.String()),
});

export const SaleAuthorityRequestResponseSchema = Type.Object({
  requestId: Type.String({ format: "uuid" }),
  status: Type.Literal("pending"),
});

export const SaleAuthorityRequestWithdrawResponseSchema = Type.Object({
  requestId: Type.String({ format: "uuid" }),
  status: Type.Literal("cancelled"),
});

/** Which seller tools the signed-in person can use, decided from their own records. */
export const PortalSellerAccessSchema = Type.Object({
  editions: Type.Boolean(),
  payouts: Type.Boolean(),
  artist: Type.Boolean(),
});

export const PortalSaleAuthorityRequestSchema = Type.Object({
  requestId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  requestedCount: Type.Integer(),
  note: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  createdAt: Type.String(),
  handledAt: Type.Union([Type.String(), Type.Null()]),
  /** Why LAX declined the request; optional so older shop-api responses still parse. */
  declineReason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const PortalSaleAuthorityRequestsResponseSchema = Type.Object({
  items: Type.Array(PortalSaleAuthorityRequestSchema),
});

export const PortalPayoutSchema = Type.Object({
  payoutId: Type.String({ format: "uuid" }),
  grossPence: Type.Integer(),
  deductionsPence: Type.Integer(),
  netPence: Type.Integer(),
  status: Type.String(),
  payoutDueAt: Type.String(),
  paidAt: Type.Union([Type.String(), Type.Null()]),
});

export const PortalPayoutsResponseSchema = Type.Object({
  items: Type.Array(PortalPayoutSchema),
});

export const PortalDocumentSchema = Type.Object({
  documentId: Type.String({ format: "uuid" }),
  kind: Type.String(),
  createdAt: Type.String(),
  downloadUrl: Type.Union([Type.String(), Type.Null()]),
});

export const PortalDocumentsResponseSchema = Type.Object({
  items: Type.Array(PortalDocumentSchema),
});

export const PortalSaleStatementSchema = Type.Object({
  saleId: Type.String({ format: "uuid" }),
  channel: Type.Union([
    Type.Literal("direct"),
    Type.Literal("third_party"),
    Type.Literal("original"),
  ]),
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  editionNumber: Type.Union([Type.Integer(), Type.Null()]),
  soldAt: Type.String(),
  grossPence: Type.Integer(),
  feesPence: Type.Integer(),
  netPence: Type.Integer(),
  payoutId: Type.String({ format: "uuid" }),
  payoutStatus: Type.String(),
});

export const PortalSalesResponseSchema = Type.Object({
  items: Type.Array(PortalSaleStatementSchema),
});

export const PortalArtistProfileSchema = Type.Object({
  artistId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  displayName: Type.String(),
});

export const PortalArtistArtworkSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  title: Type.String(),
  saleState: Type.String(),
});

export const PortalArtistArtworksResponseSchema = Type.Object({
  artist: Type.Union([PortalArtistProfileSchema, Type.Null()]),
  items: Type.Array(PortalArtistArtworkSchema),
});

export const PortalArtistSaleSchema = Type.Object({
  saleId: Type.String({ format: "uuid" }),
  channel: Type.String(),
  artworkTitle: Type.String(),
  editionNumber: Type.Union([Type.Integer(), Type.Null()]),
  grossPence: Type.Integer(),
  feesPence: Type.Union([Type.Integer(), Type.Null()]),
  netPence: Type.Union([Type.Integer(), Type.Null()]),
  arrApplicable: Type.Union([Type.Boolean(), Type.Null()]),
  occurredAt: Type.Union([Type.String(), Type.Null()]),
});

export const PortalArtistSalesResponseSchema = Type.Object({
  artist: Type.Union([PortalArtistProfileSchema, Type.Null()]),
  items: Type.Array(PortalArtistSaleSchema),
});

export type PortalEdition = Static<typeof PortalEditionSchema>;
export type PortalSaleAuthority = Static<typeof PortalSaleAuthoritySchema>;
export type PortalSaleAuthorityRequest = Static<typeof PortalSaleAuthorityRequestSchema>;
export type SaleAuthorityRequestWithdrawResponse = Static<
  typeof SaleAuthorityRequestWithdrawResponseSchema
>;
export type PortalSellerAccess = Static<typeof PortalSellerAccessSchema>;
export type PortalPayout = Static<typeof PortalPayoutSchema>;
export type PortalDocument = Static<typeof PortalDocumentSchema>;
export type PortalSaleStatement = Static<typeof PortalSaleStatementSchema>;

export const PortalCollectionEditionItemSchema = Type.Object({
  kind: Type.Literal("edition"),
  editionId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  salesChannel: Type.Union([Type.Literal("shop"), Type.Literal("art")]),
  editionNumber: Type.Integer(),
  listingStatus: Type.String(),
  custodyStatus: Type.String(),
});

export const PortalCollectionOriginalItemSchema = Type.Object({
  kind: Type.Literal("original"),
  originalSaleId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  salesChannel: Type.Union([Type.Literal("shop"), Type.Literal("art")]),
  status: Type.String(),
  acquiredAt: Type.String(),
});

export const PortalCollectionItemSchema = Type.Union([
  PortalCollectionEditionItemSchema,
  PortalCollectionOriginalItemSchema,
]);

export const PortalCollectionResponseSchema = Type.Object({
  items: Type.Array(PortalCollectionItemSchema),
});

export const PortalEnquirySchema = Type.Object({
  enquiryId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  salesChannel: Type.Union([Type.Literal("shop"), Type.Literal("art")]),
  intent: Type.String(),
  status: Type.String(),
  /** Always present from shop-api; optional so clients tolerate pre-0212 deployments. */
  message: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  contactPhone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String(),
});

export const PortalEnquiriesResponseSchema = Type.Object({
  items: Type.Array(PortalEnquirySchema),
});

export type PortalCollectionItem = Static<typeof PortalCollectionItemSchema>;
export type PortalEnquiry = Static<typeof PortalEnquirySchema>;

/** Payee's payout account on the LAX Art Stripe platform (D38). */
export const PortalPayeeConnectStatusSchema = Type.Object({
  stripeAccountId: Type.Union([Type.String(), Type.Null()]),
  chargesEnabled: Type.Boolean(),
  payoutsEnabled: Type.Boolean(),
  requirementsCurrentlyDue: Type.Array(Type.String()),
  disabledReason: Type.Union([Type.String(), Type.Null()]),
  ready: Type.Boolean(),
});

export const PortalPayeeConnectConfigSchema = Type.Object({
  publishableKey: Type.Union([Type.String(), Type.Null()]),
  connectConfigured: Type.Boolean(),
});

export const PortalPayeeConnectSessionBodySchema = Type.Object({
  surface: Type.Union([Type.Literal("onboarding"), Type.Literal("management")]),
});

export const PortalPayeeConnectSessionResponseSchema = Type.Object({
  clientSecret: Type.String({ minLength: 1 }),
});

export type PortalPayeeConnectStatus = Static<typeof PortalPayeeConnectStatusSchema>;
export type PortalPayeeConnectConfig = Static<typeof PortalPayeeConnectConfigSchema>;
export type PortalPayeeConnectSurface = Static<
  typeof PortalPayeeConnectSessionBodySchema
>["surface"];
