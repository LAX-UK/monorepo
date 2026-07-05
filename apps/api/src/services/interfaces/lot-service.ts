import type { ArchiveEndedAggregateFilter, ListLotsFilter } from "@auction/persistence/interfaces";
import type { CreateLotInput, Lot, PublicLotView, UserRole } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import type { Result } from "neverthrow";
import type { LotCancelledPayload } from "../../domain/lot-events.js";
import type { AuthzError, LotError } from "../../lib/errors.js";
import type { ReturnToInventoryInput } from "../lot-transition-orchestrator.js";
import type { ListBidsForPublicApiResult } from "../lot/lot-types.js";

export interface ILotReadService {
  getById(id: string): Promise<Lot | null>;

  list(filter: ListLotsFilter): Promise<Lot[]>;

  listLotsForPublicApi(
    filter: ListLotsFilter,
    viewerRole: string | undefined,
    viewerStaffRole?: string | null,
  ): Promise<{ data: (Lot | PublicLotView)[] }>;

  listBidsForPublicApi(input: {
    lotId: string;
    viewerRole: UserRole;
    viewerStaffRole?: string | null;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<ListBidsForPublicApiResult>;

  countWatchersForPublicApi(
    lotId: string,
  ): Promise<{ kind: "ok"; count: number } | { kind: "not_found" }>;

  countMatching(filter: Omit<ListLotsFilter, "limit" | "offset" | "sort">): Promise<number>;

  archiveEndedSummary(
    filter: ArchiveEndedAggregateFilter,
  ): Promise<{ total: string; count: number }>;
}

export interface ILotWriteService {
  create(sellerId: string, input: CreateLotInput): Promise<Result<Lot, LotError>>;

  update(
    userRole: string,
    lotId: string,
    input: Partial<CreateLotInput>,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>>;

  updateMarketingDetails(
    userRole: string,
    lotId: string,
    patch: UpdateLotMarketingDetailsInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>>;
}

export interface ILotLifecycleService {
  publish(
    userId: string,
    userRole: string,
    lotId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>>;

  cancel(
    userId: string,
    userRole: string,
    lotId: string,
    userStaffRole?: string | null,
    cancelReason?: LotCancelledPayload["reason"],
  ): Promise<Result<Lot, LotError | AuthzError>>;

  bulkPublishOrCancel(
    userId: string,
    userRole: string,
    ids: string[],
    op: "publish" | "cancel",
    userStaffRole?: string | null,
    reason?: string,
  ): Promise<
    Result<
      {
        attempted: number;
        failed: number;
        errors: Array<{ lotId: string; message: string; code?: string }>;
      },
      AuthzError
    >
  >;

  returnToInventory(
    actorUserId: string,
    userRole: string,
    lotId: string,
    input: ReturnToInventoryInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>>;

  requestWithdrawal(
    sellerUserId: string,
    lotId: string,
  ): Promise<Result<{ taskId: string; alreadyPending: boolean }, LotError | AuthzError>>;

  approveWithdrawalRequest(
    adminUserId: string,
    adminRole: UserRole,
    lotId: string,
    adminStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>>;
}

export interface ILotService extends ILotReadService, ILotWriteService, ILotLifecycleService {}
