import { type Static, Type } from "@sinclair/typebox";
import { createCursorListResponseSchema } from "./cursor-list.js";

export const AdminOrderListItemSchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  status: Type.String(),
  totalPence: Type.Integer(),
  fulfilment: Type.String(),
  buyerSubjectId: Type.String(),
  createdAt: Type.String(),
  paidAt: Type.Union([Type.String(), Type.Null()]),
});

export const AdminOrderListSchema = createCursorListResponseSchema(AdminOrderListItemSchema);

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

export const AdminProductionTaskListItemSchema = Type.Object({
  taskId: Type.String({ format: "uuid" }),
  orderLineId: Type.String({ format: "uuid" }),
  editionId: Type.String({ format: "uuid" }),
  status: Type.String(),
  createdAt: Type.String(),
});

export const AdminProductionTaskListSchema = createCursorListResponseSchema(
  AdminProductionTaskListItemSchema,
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
});

export const AdminArtistListSchema = createCursorListResponseSchema(AdminArtistListItemSchema);

export const AdminStaffMemberListItemSchema = Type.Object({
  staffMemberId: Type.String({ format: "uuid" }),
  identitySubjectId: Type.String(),
  role: Type.String(),
  disabledAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const AdminStaffMemberListSchema = createCursorListResponseSchema(
  AdminStaffMemberListItemSchema,
);

export const AdminMerchandiseProductListItemSchema = Type.Object({
  productId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  title: Type.String(),
  variantCount: Type.Integer(),
  fromPricePence: Type.Union([Type.Integer(), Type.Null()]),
  totalOnHand: Type.Integer(),
});

export const AdminMerchandiseProductListSchema = createCursorListResponseSchema(
  AdminMerchandiseProductListItemSchema,
);

export const AdminOverviewKpisSchema = Type.Object({
  fulfilmentOpenCount: Type.Integer(),
  payoutsDueCount: Type.Integer(),
  activeHoldsCount: Type.Integer(),
  pendingAuthorityRequestsCount: Type.Integer(),
});

export type AdminOverviewKpis = Static<typeof AdminOverviewKpisSchema>;
