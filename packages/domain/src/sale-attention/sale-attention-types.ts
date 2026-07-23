import type { Lot, Sale, SaleStatus } from "@auction/types";

export type SaleAttentionSeverity = "critical" | "high" | "medium" | "low";

export type SaleAttentionCategory =
  | "Setup"
  | "Delete"
  | "Bidders"
  | "Catalog"
  | "Operations"
  | "Finance"
  | "Compliance";

export type SaleAttentionKind =
  | "setup_readiness"
  | "delete_blocker"
  | "pending_registrations"
  | "awaiting_paddle"
  | "kyc_blocked"
  | "telephone_pending"
  | "connect_required"
  | "incomplete_catalog_lots"
  | "draft_lots_missing_photos"
  | "draft_lots_past_start"
  | "unsettled_sold_lots"
  | "stale_payments"
  | "fulfilment_pending"
  | "condition_reports_open"
  | "finance_review"
  | "saleroom_needs_closing"
  | "return_to_inventory";

export type SaleAttentionSignalKey =
  | "sale"
  | "lots"
  | "deleteGuards"
  | "registrations"
  | "pendingRegistrationCount"
  | "telephoneBookings"
  | "connectByLotId"
  | "conditionReports"
  | "settlement"
  | "fulfilment"
  | "finance"
  | "saleroomSession";

export type SaleAttentionTarget = {
  tab?:
    | "overview"
    | "lots"
    | "registrations"
    | "documents"
    | "schedule"
    | "operations"
    | "telephone";
  lotId?: string;
  registrationId?: string;
  external?: string;
};

export type SaleAttentionItem = {
  id: string;
  kind: SaleAttentionKind;
  category: SaleAttentionCategory;
  severity: SaleAttentionSeverity;
  count: number;
  target?: SaleAttentionTarget;
  refs?: string[];
};

export type SaleAttentionResult = {
  items: SaleAttentionItem[];
  totalCount: number;
  truncated: boolean;
};

export type SaleAttentionRegistrationSignal = {
  id: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  paddleNumber: number | null;
  checkedInAt: string | null;
  kycStatus: string | null;
};

export type SaleAttentionLotSignal = Pick<
  Lot,
  | "id"
  | "title"
  | "status"
  | "images"
  | "description"
  | "sellerLegalEntityId"
  | "artistReviewRequired"
  | "saleId"
  | "startTime"
  | "endTime"
  | "winnerId"
  | "deletedAt"
>;

export type SaleAttentionSignals = {
  notFound?: boolean;
  sale?: Sale;
  lots?: SaleAttentionLotSignal[];
  pendingRegistrationCount?: number;
  registrations?: SaleAttentionRegistrationSignal[];
  deleteBlockers?: string[];
  telephoneRequestedCount?: number;
  connectRequiredByLotId?: Record<string, boolean>;
  incompleteCatalogLotCount?: number;
  draftLotsMissingPhotosCount?: number;
  draftLotsPastStartCount?: number;
  unsettledSoldLotCount?: number;
  stalePaymentCount?: number;
  fulfilmentPendingCount?: number;
  openConditionReportCount?: number;
  financeReviewCount?: number;
  saleroomNeedsClosing?: boolean;
  returnToInventoryEligibleCount?: number;
  venueReady?: boolean;
  startInFuture?: boolean;
};

export type SaleAttentionPrincipal = {
  role: "client" | "staff" | "seller";
  staffRole: string | null;
};

export const SALE_ATTENTION_SEVERITY_RANK: Record<SaleAttentionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function isSaleAttentionStatus(status: SaleStatus): boolean {
  return (
    status === "draft" ||
    status === "scheduled" ||
    status === "active" ||
    status === "ended" ||
    status === "cancelled"
  );
}
