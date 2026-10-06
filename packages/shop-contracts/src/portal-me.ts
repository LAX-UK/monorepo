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

export type PortalEdition = Static<typeof PortalEditionSchema>;
export type PortalSaleAuthority = Static<typeof PortalSaleAuthoritySchema>;
export type PortalSaleAuthorityRequest = Static<typeof PortalSaleAuthorityRequestSchema>;
export type PortalPayout = Static<typeof PortalPayoutSchema>;
export type PortalDocument = Static<typeof PortalDocumentSchema>;
export type PortalSaleStatement = Static<typeof PortalSaleStatementSchema>;
