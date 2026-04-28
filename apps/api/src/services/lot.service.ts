import { roleHasCapability, type CreateLotInput, type Lot, type UserRole } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotNotificationCoordinator } from "./interfaces/lot-notifications.js";
import type {
  ArchiveEndedAggregateFilter,
  IBidRepository,
  ILotRepository,
  ListLotsFilter,
} from "./interfaces/repositories.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";

const CANCELLABLE: ReadonlySet<Lot["status"]> = new Set(["draft", "scheduled", "active"]);

export class LotService {
  constructor(
    private readonly lotRepo: ILotRepository,
    private readonly bids: IBidRepository,
    private readonly watchlist: IWatchlistRepository,
    private readonly jobScheduler: ILotJobScheduler | null,
    private readonly lotNotifications: ILotNotificationCoordinator | null,
  ) {}

  async create(sellerId: string, input: CreateLotInput): Promise<Result<Lot, LotError>> {
    if (input.endTime <= input.startTime) {
      return err(new LotError("endTime must be after startTime"));
    }
    const created = await this.lotRepo.create(sellerId, input);
    return ok(created);
  }

  async publish(
    _userId: string,
    userRole: string,
    lotId: string,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can publish lots", 403));
    }
    const a = await this.lotRepo.findById(lotId);
    if (!a) return err(new LotError("Lot not found", 404));
    if (a.status !== "draft") {
      return err(new LotError("Only draft lots can be published"));
    }
    if (a.startTime.getTime() <= Date.now()) {
      return err(new LotError("startTime must be in the future to publish"));
    }
    await this.lotRepo.updateStatus(lotId, "scheduled");
    const updated = await this.lotRepo.findById(lotId);
    if (!updated) return err(new LotError("Lot not found", 404));
    await this.jobScheduler?.scheduleLot(lotId, updated.startTime, updated.endTime);
    return ok(updated);
  }

  async cancel(
    _userId: string,
    userRole: string,
    lotId: string,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    const a = await this.lotRepo.findById(lotId);
    if (!a) return err(new LotError("Lot not found", 404));
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can cancel lots", 403));
    }
    if (!CANCELLABLE.has(a.status)) {
      return err(new LotError("This lot cannot be cancelled"));
    }
    await this.jobScheduler?.cancelLotJobs(lotId);
    await this.lotRepo.updateStatus(lotId, "cancelled");
    const updated = await this.lotRepo.findById(lotId);
    if (!updated) return err(new LotError("Lot not found", 404));

    if (this.lotNotifications) {
      const bidders = await this.bids.listDistinctBidderIds(lotId);
      const watchers = await this.watchlist.listUserIdsForLot(lotId);
      const recipientIds = [...new Set<string>([...bidders, ...watchers, a.sellerId])];
      await this.lotNotifications.notifyLotCancelled({
        lotId,
        title: a.title,
        recipientIds,
      });
    }

    return ok(updated);
  }

  async update(
    userRole: string,
    lotId: string,
    input: Partial<CreateLotInput>,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can edit lots", 403));
    }
    const a = await this.lotRepo.findById(lotId);
    if (!a) return err(new LotError("Lot not found", 404));
    if (a.status !== "draft") {
      return err(new LotError("Only draft lots can be edited"));
    }
    const nextStart = input.startTime ?? a.startTime;
    const nextEnd = input.endTime ?? a.endTime;
    if (nextEnd <= nextStart) {
      return err(new LotError("endTime must be after startTime"));
    }
    const updated = await this.lotRepo.update(lotId, input);
    return ok(updated);
  }

  async updateMarketingDetails(
    userRole: string,
    lotId: string,
    patch: UpdateLotMarketingDetailsInput,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can update marketing details", 403));
    }
    const a = await this.lotRepo.findById(lotId);
    if (!a) return err(new LotError("Lot not found", 404));
    if (a.status === "cancelled" || a.status === "ended") {
      return err(new LotError("Cannot update marketing details for this lot", 400));
    }
    const updated = await this.lotRepo.updateMarketingDetails(lotId, patch);
    return ok(updated);
  }

  async getById(id: string): Promise<Lot | null> {
    return this.lotRepo.findById(id);
  }

  async list(filter: ListLotsFilter): Promise<Lot[]> {
    return this.lotRepo.list(filter);
  }

  countMatching(filter: Omit<ListLotsFilter, "limit" | "offset" | "sort">): Promise<number> {
    return this.lotRepo.countMatching(filter);
  }

  archiveEndedSummary(filter: ArchiveEndedAggregateFilter) {
    return this.lotRepo.sumEndedHammer(filter);
  }
}
