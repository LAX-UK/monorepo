import type { CreateCategoryInput, UpdateCategoryInput } from "@auction/persistence/interfaces";
import type {
  AdminArtistListResult,
  AdminArtistStats,
  AdminCategoriesListSummary,
  AdminCategory,
  AdminCategoryListResult,
  ArtistProfile,
  Category,
  Lot,
  UserRole,
  UserStaffRole,
} from "@auction/types";
import type { ResolvedQrCodeAnalyticsQuery } from "@auction/validators";
import type { Result } from "neverthrow";
import type {
  AdminArtistListOptions,
  AdminCatalogCreateArtistBody,
  AdminCatalogUpdateArtistBody,
} from "../../../admin/admin-route-dtos.js";
import type { AdminConditionReportListPage } from "../../admin/admin-condition-report-list-query.service.js";
import type { AdminLotFulfilmentListPage } from "../../admin/admin-lot-fulfilment-list-query.service.js";
import type {
  LotLifecycleSnapshotRow,
  LotLifecycleTimelineEvent,
} from "../../lot-lifecycle-query.service.js";
import type { LotTransitionOrchestrator } from "../../lot-transition-orchestrator.js";
import type { QrCodeAnalyticsService } from "../../qr-code-analytics.service.js";
import type { QrCodeService } from "../../qr-code.service.js";
import type { ArtistSearchHit } from "../artist-registry.js";
import type {
  ConditionReportServiceError,
  FulfillConditionReportInput,
  IConditionReportService,
} from "../condition-report.js";
import type { ILotFulfilmentAdminService } from "../lot-fulfilment-service.js";
import type { ISaleRegistrationAdminService } from "../sale-registration-service.js";

export interface IAdminCatalogApplicationService {
  listCategoriesForAdmin(input: { includeArchived: boolean }): Promise<AdminCategory[]>;
  listCategoryPageForAdmin(input: {
    includeArchived: boolean;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<AdminCategoryListResult>;
  getCategoriesListSummary(input: {
    includeArchived: boolean;
  }): Promise<AdminCategoriesListSummary>;
  createCategory(body: CreateCategoryInput, actorUserId?: string | null): Promise<Category>;
  getCategory(categoryId: string): Promise<AdminCategory | null>;
  updateCategory(
    categoryId: string,
    body: UpdateCategoryInput,
    actorUserId?: string | null,
  ): Promise<Category>;
  archiveCategory(categoryId: string, actorUserId?: string | null): Promise<Category>;
  deleteCategory(categoryId: string, actorUserId?: string | null): Promise<void>;
  listArtists(input: AdminArtistListOptions): Promise<AdminArtistListResult>;
  getArtistStats(): Promise<AdminArtistStats>;
  listArtistDuplicateCandidates(artistId: string): Promise<ArtistSearchHit[]>;
  createArtist(adminUserId: string, body: AdminCatalogCreateArtistBody): Promise<ArtistProfile>;
  getArtist(artistId: string): Promise<ArtistProfile | null>;
  updateArtist(artistId: string, body: AdminCatalogUpdateArtistBody): Promise<ArtistProfile>;
  searchArtists(query: string, limit?: number): Promise<ArtistSearchHit[]>;
  resolvePlatformCatalogLegalEntityId(): Promise<string | null>;
}

export interface IAdminLotsApplicationService {
  approveWithdrawalRequest(
    adminUserId: string,
    adminRole: UserRole,
    lotId: string,
    adminStaffRole?: UserStaffRole | null,
  ): Promise<
    | { ok: true; data: Lot }
    | { ok: false; status: number; error: string; code?: string | undefined }
  >;
  listAttachable(
    input: import("../../admin/admin-lot-browse.types.js").AdminLotBrowseInput,
  ): Promise<{
    data: import("../../admin/admin-lot-browse.types.js").AdminAttachableLotRow[];
    total: number;
  }>;
  returnToInventory: LotTransitionOrchestrator["returnToInventory"];
  getLifecycle(
    lotId: string,
    opts?: { limit?: number; includeSaleContext?: boolean },
  ): Promise<{
    snapshot: LotLifecycleSnapshotRow | null;
    events: LotLifecycleTimelineEvent[];
  }>;
}

export interface IAdminSaleRegistrationsApplicationService {
  listForSaleAdmin: ISaleRegistrationAdminService["listForSaleAdmin"];
  approve: ISaleRegistrationAdminService["approve"];
  reject: ISaleRegistrationAdminService["reject"];
  updateBidLimit: ISaleRegistrationAdminService["updateBidLimit"];
}

export interface IAdminLotFulfilmentApplicationService {
  getPage(input: {
    q?: string;
    status?: import("@auction/persistence/interfaces").LotFulfilmentRow["status"];
    limit: number;
    offset: number;
  }): Promise<AdminLotFulfilmentListPage>;
  listForAdmin: ILotFulfilmentAdminService["listForAdmin"];
  getByLotIdForAdmin: ILotFulfilmentAdminService["getByLotIdForAdmin"];
  approveRelease: ILotFulfilmentAdminService["approveRelease"];
  markShipped: ILotFulfilmentAdminService["markShipped"];
  markReadyForCollection: ILotFulfilmentAdminService["markReadyForCollection"];
  markDelivered: ILotFulfilmentAdminService["markDelivered"];
  markCollected: ILotFulfilmentAdminService["markCollected"];
}

export interface IAdminQrCodesApplicationService {
  listForEntity: QrCodeService["listForEntity"];
  getOrCreateDefault: QrCodeService["getOrCreateDefault"];
  update: QrCodeService["update"];
  regenerateDefault: QrCodeService["regenerateDefault"];
  getDetailedAnalytics(
    id: string,
    query: ResolvedQrCodeAnalyticsQuery,
  ): ReturnType<QrCodeAnalyticsService["getDetailed"]>;
}

export interface IAdminConditionReportsApplicationService {
  getPage(input: {
    status?: "open" | "pending" | "in_progress" | "fulfilled" | "declined";
    lotId?: string;
    limit: number;
    offset: number;
  }): Promise<AdminConditionReportListPage>;
  listForAdmin: IConditionReportService["listForAdmin"];
  markInProgress: IConditionReportService["markInProgress"];
  fulfill(input: FulfillConditionReportInput): Promise<Result<Lot, ConditionReportServiceError>>;
  decline: IConditionReportService["decline"];
}

export type AdminCatalogRouteServices = {
  catalog: IAdminCatalogApplicationService;
  lots: IAdminLotsApplicationService;
  saleRegistrations: IAdminSaleRegistrationsApplicationService;
  lotFulfilment: IAdminLotFulfilmentApplicationService;
  qrCodes: IAdminQrCodesApplicationService;
  conditionReports: IAdminConditionReportsApplicationService;
};
