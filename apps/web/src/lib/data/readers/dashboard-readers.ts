import type { ListLotsParams, SessionUser } from "@/lib/data/contracts";
import type {
  ArtistFollowRow,
  BidWithLot,
  KycStatusSummaryDto,
  OrgOnboardingResumeVm,
  ProfileAddressRow,
  WatchlistListParams,
  WatchlistWithLotRow,
} from "@/lib/data/dto/dashboard-dtos";
import type { PostKycSessionResult } from "@/lib/data/http/kyc.server";
import type { ListMyNotificationsParams } from "@/lib/data/http/notifications.server";
import type {
  LotFulfilmentSnapshot,
  MyPaymentRow,
  MyPaymentsListParams,
} from "@/lib/data/http/payments.server";
import type { SaleWithLots } from "@/lib/data/http/sales.server";
import type {
  SellerPayoutListResult,
  SellerPayoutPreviewResult,
} from "@/lib/data/http/seller-payouts.server";
import type { StripeConnectStatusLoadResult } from "@/lib/data/http/stripe-connect.server";
import type { MySessionsLoadResult } from "@/lib/data/user-session-row";
import type {
  Category,
  CategoryNode,
  ItemSubmission,
  ItemSubmissionStatus,
  LegalEntitySummary,
  Lot,
  NotificationPreference,
  PortfolioRow,
  UserNotification,
} from "@auction/types";

/** ISP: read-only bids for dashboard surfaces */
export type DashboardBidsReader = {
  listMine(): Promise<BidWithLot[]>;
};

export type DashboardPortfolioReader = {
  listMine(): Promise<PortfolioRow[]>;
};

export type DashboardWatchlistReader = {
  listMine(params?: WatchlistListParams): Promise<WatchlistWithLotRow[]>;
};

export type DashboardArtistFollowReader = {
  listMine(): Promise<ArtistFollowRow[]>;
};

export type DashboardActiveLotsReader = {
  listActivePreview(limit: number): Promise<Lot[]>;
};

/** ISP: buyer-only payments view (no admin/seller endpoints leak in). */
export type DashboardPaymentsReader = {
  listMine(params?: MyPaymentsListParams): Promise<MyPaymentRow[]>;
  getLotFulfilmentForWinner(lotId: string): Promise<LotFulfilmentSnapshot | null>;
};

/** Sale + lots bundle for seller / marketing surfaces. */
export type DashboardSalesReader = {
  getWithLots(id: string): Promise<SaleWithLots | null>;
};

/** Entity-scoped seller payouts (`X-Legal-Entity-Id` on list + preview-next). */
export type DashboardSellerPayoutsReader = {
  listForLegalEntity(legalEntityId: string): Promise<SellerPayoutListResult>;
  previewNextForLegalEntity(legalEntityId: string): Promise<SellerPayoutPreviewResult>;
};

/** Stripe Connect onboarding for the acting context (`GET /stripe-connect/status`). */
export type DashboardStripeConnectReader = {
  getStatus(): Promise<StripeConnectStatusLoadResult>;
};

/** Current session user (Better Auth / hc `users.me`). */
export type DashboardSessionReader = {
  getCurrent(): Promise<SessionUser | null>;
};

/** KYC summary + hosted verification session for dashboard. */
export type DashboardKycReader = {
  getSummary(): Promise<KycStatusSummaryDto | null>;
  startSession(returnUrl: string): Promise<PostKycSessionResult>;
};

export type DashboardNotificationsReader = {
  listMine(params?: ListMyNotificationsParams): Promise<UserNotification[]>;
  listMineSafe(
    params?: ListMyNotificationsParams,
  ): Promise<{ items: UserNotification[]; failed: boolean }>;
};

export type DashboardAddressesReader = {
  listMine(): Promise<ProfileAddressRow[]>;
};

export type DashboardLegalEntitiesReader = {
  listMine(): Promise<LegalEntitySummary[]>;
};

export type DashboardNotificationPreferencesReader = {
  getMine(): Promise<NotificationPreference | null>;
};

export type DashboardSessionsReader = {
  listMine(): Promise<MySessionsLoadResult>;
};

export type DashboardSubmissionsReader = {
  listMine(params?: {
    status?: ItemSubmissionStatus;
    limit?: number;
    offset?: number;
  }): Promise<ItemSubmission[]>;
  getMineById(id: string): Promise<ItemSubmission | null>;
};

export type DashboardOrgOnboardingReader = {
  getResume(): Promise<OrgOnboardingResumeVm | null>;
};

export type DashboardCategoriesReader = {
  list(): Promise<Category[]>;
  tree(): Promise<CategoryNode[]>;
};

/** Single-lot read for checkout / deep links (winner flows). */
export type DashboardBuyerLotReader = {
  getById(id: string): Promise<Lot | null>;
};

/** Listing lots for seller workspace (acting entity). */
export type DashboardSellerLotReader = {
  list(params: ListLotsParams): Promise<Lot[]>;
};
