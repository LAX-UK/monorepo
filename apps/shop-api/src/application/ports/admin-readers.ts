import type {
  AdminArtistDetail,
  AdminArtworkLookupItem,
  AdminAuditEntry,
  AdminAuditFacets,
  AdminAuditListQuery,
  AdminClientDetail,
  AdminClientListQuery,
  AdminDisputeListItem,
  AdminDisputeListQuery,
  AdminEditionLookupItem,
  AdminEffectiveSettings,
  AdminFulfilmentListQuery,
  AdminOrderDetail,
  AdminOriginalSaleListQuery,
  AdminOverviewKpis,
  AdminPartyLookupItem,
  AdminPayoutListQuery,
  AdminSaleAuthorityRequestListQuery,
  AdminStaffListQuery,
  AdminStockHoldListQuery,
  AdminThirdPartySaleListQuery,
  MerchandiseProductDetail,
  MerchandiseProductListItem,
  MerchandiseStatus,
} from "@auction/shop-contracts";
import type { OverviewKpiKey } from "@auction/shop-domain";
import type { AdminArtworkReader } from "./artwork-catalogue-admin.js";

import type { CursorListInput, CursorListResult } from "./cursor-list.js";

export type { CursorListInput, CursorListResult };

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

/** A work list page with the per-status counts its views show (every filter but status). */
export type WorkListResult<T> = CursorListResult<T> & { counts: Record<string, number> };

export type AdminFulfilmentListItem = {
  fulfilmentId: string;
  orderId: string;
  status: string;
  option: string;
  carrier: string | null;
  trackingNumber: string | null;
  updatedAt: string;
  possessionAt: string | null;
  paidAt: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
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
  paidReference: string | null;
  createdAt: string;
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
  clientName: string;
  brokerName: string | null;
  note: string | null;
  createdAt: string;
};

export type AdminThirdPartySaleListItem = {
  saleId: string;
  editionId: string;
  artworkTitle: string;
  editionNumber: number;
  status: string;
  grossPence: number;
  recordedAt: string | null;
  fees: Array<{ feeId: string; label: string; amountPence: number; status: string }>;
  sellerName: string;
  buyerName: string;
  createdAt: string;
};

export type AdminOriginalSaleListItem = {
  saleId: string;
  artworkId: string;
  artworkTitle: string;
  status: string;
  salePricePence: number;
  createdAt: string;
  buyerName: string;
  buyerEmail: string | null;
  reservationExpiresAt: string | null;
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
  note: string | null;
  declineReason: string | null;
  handledAt: string | null;
};

export type AdminPartyListItem = {
  partyId: string;
  displayName: string;
  kind: string;
  identitySubjectId: string | null;
  createdAt: string;
  email: string | null;
  editionCount: number;
  paidOrderCount: number;
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
  /** A to Z by name when absent. */
  sort?: "name_asc" | "name_desc" | "created_desc" | "created_asc" | undefined;
};

export type AdminArtistListResult = CursorListResult<AdminArtistListItem> & {
  /** Matches per status under the search, for the view tabs. */
  counts: { active: number; archived: number };
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

/** Orders per UK day ("YYYY-MM-DD"), on or after `since`; days without orders are absent. */
export type AdminOrderDailyTotals = {
  /** Order totals in pence and number of orders, by the day they were paid. */
  paid: ReadonlyMap<string, { pence: number; orders: number }>;
  /** Orders by the day they were placed. */
  placed: ReadonlyMap<string, number>;
};

export interface AdminOrderReader {
  listOrders(input: AdminOrderListInput): Promise<AdminOrderListResult>;
  getOrderDetail(orderId: string): Promise<AdminOrderDetail>;
  readOrderDailyTotals(since: Date): Promise<AdminOrderDailyTotals>;
}

export interface AdminFulfilmentReader {
  listFulfilment(input: AdminFulfilmentListQuery): Promise<WorkListResult<AdminFulfilmentListItem>>;
}

export interface AdminPayoutReader {
  listPayouts(input: AdminPayoutListQuery): Promise<WorkListResult<AdminPayoutListItem>>;
}

export type StockHoldListInput = AdminStockHoldListQuery & {
  /** When set, only holds for clients assigned to this broker subject are returned. */
  brokerSubjectId?: string;
};

export interface AdminSalesReader {
  listStockHolds(input: StockHoldListInput): Promise<WorkListResult<AdminStockHoldListItem>>;
  listThirdPartySales(
    input: AdminThirdPartySaleListQuery,
  ): Promise<WorkListResult<AdminThirdPartySaleListItem>>;
  listOriginalSales(
    input: AdminOriginalSaleListQuery,
  ): Promise<WorkListResult<AdminOriginalSaleListItem>>;
}

export type ClientPartyListInput = AdminClientListQuery & {
  /** When set, only clients assigned to this broker subject are returned. */
  brokerSubjectId?: string;
};

export interface AdminPartyReader {
  /** Counts are per kind, under the search but not the kind. */
  listClientParties(input: ClientPartyListInput): Promise<WorkListResult<AdminPartyListItem>>;
  listArtists(input: AdminArtistListInput): Promise<AdminArtistListResult>;
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
    input: AdminSaleAuthorityRequestListQuery,
  ): Promise<WorkListResult<AdminSaleAuthorityRequestListItem>>;
  getRequestById(requestId: string): Promise<SaleAuthorityRequestDetail>;
}

export interface AdminStaffReader {
  /** Counts are per status (active, disabled), under the search and role but not the status. */
  listStaffMembers(input: AdminStaffListQuery): Promise<WorkListResult<AdminStaffMemberListItem>>;
}

export type MerchandiseProductListInput = CursorListInput & {
  /** Matches the title, slug or the SKU of any variant. */
  q?: string | undefined;
  status?: MerchandiseStatus | undefined;
};

export interface AdminCatalogueReader {
  listMerchandiseProducts(
    input: MerchandiseProductListInput,
  ): Promise<WorkListResult<MerchandiseProductListItem>>;
  getMerchandiseProduct(productId: string): Promise<MerchandiseProductDetail | null>;
}

export interface AdminOverviewReader {
  /** Reads only the requested figures; the caller decides which the role may see. */
  readOverviewKpis(keys: readonly OverviewKpiKey[]): Promise<AdminOverviewKpis>;
}

export interface AdminComplianceReader {
  listAuditEntries(input: AdminAuditListQuery): Promise<CursorListResult<AdminAuditEntry>>;
  /** The event codes, record kinds and people in the log, for its filters. */
  readAuditFacets(): Promise<AdminAuditFacets>;
  listDisputes(input: AdminDisputeListQuery): Promise<WorkListResult<AdminDisputeListItem>>;
  readEffectiveSettings(): Promise<AdminEffectiveSettings>;
}

export type AdminLookupInput = {
  /** Text to match; empty returns a sensible default page. */
  q?: string | undefined;
  limit: number;
};

/** Name-first searches behind the staff pickers, each one bounded page. */
export interface AdminLookupReader {
  searchParties(
    input: AdminLookupInput & {
      /** When set, only clients assigned to this broker subject are returned. */
      brokerSubjectId?: string | undefined;
    },
  ): Promise<AdminPartyLookupItem[]>;
  searchArtworks(input: AdminLookupInput): Promise<AdminArtworkLookupItem[]>;
  searchEditions(input: AdminLookupInput): Promise<AdminEditionLookupItem[]>;
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
  lookups: AdminLookupReader;
};
