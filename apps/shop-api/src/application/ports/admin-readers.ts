import type {
  AdminArtistDetail,
  AdminAuditEntry,
  AdminClientDetail,
  AdminDisputeListItem,
  AdminEffectiveSettings,
  AdminOrderDetail,
  AdminOverviewKpis,
  MerchandiseProductDetail,
  MerchandiseProductListItem,
  MerchandiseStatus,
} from "@auction/shop-contracts";
import type { OverviewKpiKey } from "@auction/shop-domain";
import type { AdminArtworkReader } from "./artwork-catalogue-admin.js";

export type CursorListInput = {
  cursor?: string | undefined;
  limit?: number | undefined;
};

export type CursorListResult<T> = {
  items: T[];
  nextCursor: string | null;
};

export type AdminOrderListFilters = {
  status?: string;
  /** Inclusive first calendar day (UK time) an order may have been created on. */
  createdFrom?: string;
  /** Inclusive last calendar day (UK time) an order may have been created on. */
  createdTo?: string;
  /** Free text: order number prefix, buyer email or name, delivery recipient name. */
  q?: string;
};

export type AdminOrderListInput = CursorListInput & AdminOrderListFilters;

export type AdminOrderListResult = CursorListResult<AdminOrderListItem> & {
  /** Matches per status under every filter except `status`. */
  counts: Record<string, number>;
};

export type AdminOrderListItem = {
  orderId: string;
  status: string;
  totalPence: number;
  fulfilment: string;
  buyerSubjectId: string;
  buyerName: string | null;
  buyerEmail: string | null;
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
  archived: boolean;
  /** Artworks of every state, drafts and archived included. */
  artworkCount: number;
};

export type AdminArtistListInput = CursorListInput & {
  /** Name or slug, anywhere in the text. */
  q?: string | undefined;
  status?: "active" | "archived" | undefined;
};

export type AdminStaffMemberListItem = {
  staffMemberId: string;
  identitySubjectId: string;
  displayName: string | null;
  email: string | null;
  lastActiveAt: string | null;
  role: string;
  disabledAt: string | null;
  createdAt: string;
};

export interface AdminOrderReader {
  listOrders(input: AdminOrderListInput): Promise<AdminOrderListResult>;
  getOrderDetail(orderId: string): Promise<AdminOrderDetail>;
}

export interface AdminFulfilmentReader {
  listFulfilment(input: CursorListInput): Promise<CursorListResult<AdminFulfilmentListItem>>;
}

export interface AdminPayoutReader {
  listPayouts(input: CursorListInput): Promise<CursorListResult<AdminPayoutListItem>>;
}

export type StockHoldListInput = CursorListInput & {
  /** When set, only holds for clients assigned to this broker subject are returned. */
  brokerSubjectId?: string;
};

export interface AdminSalesReader {
  listStockHolds(input: StockHoldListInput): Promise<CursorListResult<AdminStockHoldListItem>>;
  listThirdPartySales(
    input: CursorListInput,
  ): Promise<CursorListResult<AdminThirdPartySaleListItem>>;
  listOriginalSales(input: CursorListInput): Promise<CursorListResult<AdminOriginalSaleListItem>>;
}

export type ClientPartyListInput = CursorListInput & {
  /** When set, only clients assigned to this broker subject are returned. */
  brokerSubjectId?: string;
};

export interface AdminPartyReader {
  listClientParties(input: ClientPartyListInput): Promise<CursorListResult<AdminPartyListItem>>;
  listArtists(input: AdminArtistListInput): Promise<CursorListResult<AdminArtistListItem>>;
  getClientDetail(partyId: string): Promise<AdminClientDetail>;
  getArtistDetail(artistId: string): Promise<AdminArtistDetail>;
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

export type MerchandiseProductListInput = CursorListInput & {
  /** Matches the title, slug or the SKU of any variant. */
  q?: string | undefined;
  status?: MerchandiseStatus | undefined;
};

export interface AdminCatalogueReader {
  listMerchandiseProducts(
    input: MerchandiseProductListInput,
  ): Promise<CursorListResult<MerchandiseProductListItem>>;
  getMerchandiseProduct(productId: string): Promise<MerchandiseProductDetail | null>;
}

export interface AdminOverviewReader {
  /** Reads only the requested figures; the caller decides which the role may see. */
  readOverviewKpis(keys: readonly OverviewKpiKey[]): Promise<AdminOverviewKpis>;
}

export interface AdminComplianceReader {
  listAuditEntries(input: CursorListInput): Promise<CursorListResult<AdminAuditEntry>>;
  listDisputes(input: CursorListInput): Promise<CursorListResult<AdminDisputeListItem>>;
  readEffectiveSettings(): Promise<AdminEffectiveSettings>;
}

export type AdminReadPorts = {
  orders: AdminOrderReader;
  artworks: AdminArtworkReader;
  fulfilment: AdminFulfilmentReader;
  payouts: AdminPayoutReader;
  sales: AdminSalesReader;
  parties: AdminPartyReader;
  saleAuthorityRequests: AdminSaleAuthorityRequestReader;
  staff: AdminStaffReader;
  catalogue: AdminCatalogueReader;
  overview: AdminOverviewReader;
  compliance: AdminComplianceReader;
};
