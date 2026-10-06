import type { AdminOverviewKpis } from "@auction/shop-contracts";

export type CursorListInput = {
  cursor?: string | undefined;
  limit?: number | undefined;
};

export type CursorListResult<T> = {
  items: T[];
  nextCursor: string | null;
};

export type AdminOrderListItem = {
  orderId: string;
  status: string;
  totalPence: number;
  fulfilment: string;
  buyerSubjectId: string;
  createdAt: string;
  paidAt: string | null;
};

export type AdminFulfilmentListItem = {
  fulfilmentId: string;
  orderId: string;
  status: string;
  option: string;
  carrier: string | null;
  trackingNumber: string | null;
  updatedAt: string;
};

export type AdminProductionTaskListItem = {
  taskId: string;
  orderLineId: string;
  editionId: string;
  status: string;
  createdAt: string;
};

export type AdminPayoutListItem = {
  payoutId: string;
  ownerPartyId: string;
  ownerDisplayName: string;
  source: string;
  grossPence: number;
  deductionsPence: number;
  netPence: number;
  status: string;
  payoutDueAt: string;
  paidAt: string | null;
};

export type AdminStockHoldListItem = {
  holdId: string;
  editionId: string;
  artworkTitle: string;
  editionNumber: number;
  status: string;
  expiresAt: string;
  brokerPartyId: string | null;
  clientPartyId: string;
};

export type AdminThirdPartySaleListItem = {
  saleId: string;
  editionId: string;
  artworkTitle: string;
  editionNumber: number;
  status: string;
  grossPence: number;
  recordedAt: string | null;
};

export type AdminOriginalSaleListItem = {
  saleId: string;
  artworkId: string;
  artworkTitle: string;
  status: string;
  salePricePence: number;
  createdAt: string;
};

export type AdminSaleAuthorityRequestListItem = {
  requestId: string;
  artworkId: string;
  artworkTitle: string;
  ownerPartyId: string;
  ownerDisplayName: string;
  requestedCount: number;
  status: string;
  createdAt: string;
};

export type AdminPartyListItem = {
  partyId: string;
  displayName: string;
  kind: string;
  identitySubjectId: string | null;
  createdAt: string;
};

export type AdminArtistListItem = {
  artistId: string;
  slug: string;
  displayName: string;
  discipline: string | null;
  createdAt: string;
};

export type AdminStaffMemberListItem = {
  staffMemberId: string;
  identitySubjectId: string;
  role: string;
  disabledAt: string | null;
  createdAt: string;
};

export type AdminMerchandiseProductListItem = {
  productId: string;
  slug: string;
  title: string;
  variantCount: number;
  fromPricePence: number | null;
  totalOnHand: number;
};

export interface AdminOrderReader {
  listOrders(input: CursorListInput): Promise<CursorListResult<AdminOrderListItem>>;
}

export interface AdminFulfilmentReader {
  listFulfilment(input: CursorListInput): Promise<CursorListResult<AdminFulfilmentListItem>>;
}

export interface AdminProductionReader {
  listProductionTasks(
    input: CursorListInput,
  ): Promise<CursorListResult<AdminProductionTaskListItem>>;
}

export interface AdminPayoutReader {
  listPayouts(input: CursorListInput): Promise<CursorListResult<AdminPayoutListItem>>;
}

export interface AdminSalesReader {
  listStockHolds(input: CursorListInput): Promise<CursorListResult<AdminStockHoldListItem>>;
  listThirdPartySales(
    input: CursorListInput,
  ): Promise<CursorListResult<AdminThirdPartySaleListItem>>;
  listOriginalSales(input: CursorListInput): Promise<CursorListResult<AdminOriginalSaleListItem>>;
}

export interface AdminPartyReader {
  listClientParties(input: CursorListInput): Promise<CursorListResult<AdminPartyListItem>>;
  listArtists(input: CursorListInput): Promise<CursorListResult<AdminArtistListItem>>;
}

export type SaleAuthorityRequestDetail = {
  requestId: string;
  artworkId: string;
  ownerPartyId: string;
  requestedCount: number;
  status: string;
};

export interface AdminSaleAuthorityRequestReader {
  listRequests(
    input: CursorListInput & { status?: string | undefined },
  ): Promise<CursorListResult<AdminSaleAuthorityRequestListItem>>;
  getRequestById(requestId: string): Promise<SaleAuthorityRequestDetail>;
}

export interface AdminStaffReader {
  listStaffMembers(input: CursorListInput): Promise<CursorListResult<AdminStaffMemberListItem>>;
}

export interface AdminCatalogueReader {
  listMerchandiseProducts(
    input: CursorListInput,
  ): Promise<CursorListResult<AdminMerchandiseProductListItem>>;
}

export interface AdminOverviewReader {
  readOverviewKpis(): Promise<AdminOverviewKpis>;
}

export type AdminReadPorts = {
  orders: AdminOrderReader;
  fulfilment: AdminFulfilmentReader;
  production: AdminProductionReader;
  payouts: AdminPayoutReader;
  sales: AdminSalesReader;
  parties: AdminPartyReader;
  saleAuthorityRequests: AdminSaleAuthorityRequestReader;
  staff: AdminStaffReader;
  catalogue: AdminCatalogueReader;
  overview: AdminOverviewReader;
};
