import type { Auction, CreateAuctionInput } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { AuctionJobScheduler } from "../jobs/auction-job-scheduler.js";
import { AuctionError, AuthzError } from "../lib/errors.js";
import type { INotificationWriteRepository } from "./interfaces/notification-write.js";
import type {
  ArchiveEndedAggregateFilter,
  IAuctionRepository,
  IBidRepository,
  ListAuctionsFilter,
} from "./interfaces/repositories.js";
import type { IUserNotificationPublisher } from "./interfaces/user-notification-publisher.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";

const CANCELLABLE: ReadonlySet<Auction["status"]> = new Set(["draft", "scheduled", "active"]);

export class AuctionService {
  constructor(
    private readonly auctionRepo: IAuctionRepository,
    private readonly bids: IBidRepository,
    private readonly watchlist: IWatchlistRepository,
    private readonly notificationWrite: INotificationWriteRepository | null,
    private readonly userNotificationPublisher: IUserNotificationPublisher | null,
    private readonly jobScheduler: AuctionJobScheduler | null,
  ) {}

  async create(
    sellerId: string,
    input: CreateAuctionInput,
  ): Promise<Result<Auction, AuctionError>> {
    if (input.endTime <= input.startTime) {
      return err(new AuctionError("endTime must be after startTime"));
    }
    const created = await this.auctionRepo.create(sellerId, input);
    return ok(created);
  }

  async publish(
    _userId: string,
    userRole: string,
    auctionId: string,
  ): Promise<Result<Auction, AuctionError | AuthzError>> {
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can publish auctions", 403));
    }
    const a = await this.auctionRepo.findById(auctionId);
    if (!a) return err(new AuctionError("Auction not found", 404));
    if (a.status !== "draft") {
      return err(new AuctionError("Only draft auctions can be published"));
    }
    if (a.startTime.getTime() <= Date.now()) {
      return err(new AuctionError("startTime must be in the future to publish"));
    }
    await this.auctionRepo.updateStatus(auctionId, "scheduled");
    const updated = await this.auctionRepo.findById(auctionId);
    if (!updated) return err(new AuctionError("Auction not found", 404));
    await this.jobScheduler?.scheduleAuction(auctionId, updated.startTime, updated.endTime);
    return ok(updated);
  }

  async cancel(
    _userId: string,
    userRole: string,
    auctionId: string,
  ): Promise<Result<Auction, AuctionError | AuthzError>> {
    const a = await this.auctionRepo.findById(auctionId);
    if (!a) return err(new AuctionError("Auction not found", 404));
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can cancel auctions", 403));
    }
    if (!CANCELLABLE.has(a.status)) {
      return err(new AuctionError("This auction cannot be cancelled"));
    }
    await this.jobScheduler?.cancelAuctionJobs(auctionId);
    await this.auctionRepo.updateStatus(auctionId, "cancelled");
    const updated = await this.auctionRepo.findById(auctionId);
    if (!updated) return err(new AuctionError("Auction not found", 404));

    if (this.notificationWrite) {
      const bidders = await this.bids.listDistinctBidderIds(auctionId);
      const watchers = await this.watchlist.listUserIdsForAuction(auctionId);
      const recipientIds = new Set<string>([...bidders, ...watchers, a.sellerId]);
      const persisted = await this.notificationWrite.createMany(
        [...recipientIds].map((uid) => ({
          userId: uid,
          type: "auction_cancelled",
          title: "Auction cancelled",
          message: `The auction "${a.title}" has been cancelled.`,
          auctionId,
        })),
      );
      if (this.userNotificationPublisher) {
        for (const row of persisted) {
          await this.userNotificationPublisher.publish(row.userId, row);
        }
      }
    }

    return ok(updated);
  }

  async update(
    userRole: string,
    auctionId: string,
    input: Partial<CreateAuctionInput>,
  ): Promise<Result<Auction, AuctionError | AuthzError>> {
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can edit auctions", 403));
    }
    const a = await this.auctionRepo.findById(auctionId);
    if (!a) return err(new AuctionError("Auction not found", 404));
    if (a.status !== "draft") {
      return err(new AuctionError("Only draft auctions can be edited"));
    }
    const nextStart = input.startTime ?? a.startTime;
    const nextEnd = input.endTime ?? a.endTime;
    if (nextEnd <= nextStart) {
      return err(new AuctionError("endTime must be after startTime"));
    }
    const updated = await this.auctionRepo.update(auctionId, input);
    return ok(updated);
  }

  async getById(id: string): Promise<Auction | null> {
    return this.auctionRepo.findById(id);
  }

  async list(filter: ListAuctionsFilter): Promise<Auction[]> {
    return this.auctionRepo.list(filter);
  }

  countMatching(filter: Omit<ListAuctionsFilter, "limit" | "offset" | "sort">): Promise<number> {
    return this.auctionRepo.countMatching(filter);
  }

  archiveEndedSummary(filter: ArchiveEndedAggregateFilter) {
    return this.auctionRepo.sumEndedHammer(filter);
  }
}
