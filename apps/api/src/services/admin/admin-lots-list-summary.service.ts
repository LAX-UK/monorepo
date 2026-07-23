import type { IAdminReviewTaskReader, ILotRepository } from "@auction/persistence/interfaces";

/** Active lots ending within this window count toward the "Ending soon" lens badge. */
export const LOTS_ENDING_SOON_HOURS = 72;

export type AdminLotsLensCounts = {
  all: number;
  live: number;
  draft: number;
  ending: number;
  attention: number;
};

export type AdminLotsListSummary = {
  liveCount: number;
  draftCount: number;
  endingSoonCount: number;
  needsAttentionCount: number;
  endedCount: number;
  /** Lots that have left draft (scheduled, live, ended, etc.). */
  publishedCount: number;
  totalHammerValue: string;
  lensCounts: AdminLotsLensCounts;
};

export class AdminLotsListSummaryService {
  constructor(
    private readonly lotRepo: ILotRepository,
    private readonly reviewTaskReader: IAdminReviewTaskReader,
  ) {}

  async getSummary(): Promise<AdminLotsListSummary> {
    const [
      liveCount,
      draftCount,
      endingSoonCount,
      draftMissingPhotos,
      withdrawalsPending,
      endedCount,
      hammer,
      lensAll,
      lensLive,
      lensDraft,
      lensEnding,
    ] = await Promise.all([
      this.lotRepo.countMatching({ status: "active" }),
      this.lotRepo.countMatching({ status: "draft" }),
      this.lotRepo.countMatching({
        status: "active",
        endingWithinHours: LOTS_ENDING_SOON_HOURS,
      }),
      this.lotRepo.countMatching({ status: "draft", needsPhotos: true }),
      this.reviewTaskReader.countPendingAdminReviewTasks("lot_withdrawal_request"),
      this.lotRepo.countMatching({ status: "ended" }),
      this.lotRepo.sumEndedHammer({}),
      this.lotRepo.countMatching({}),
      this.lotRepo.countMatching({ status: "active" }),
      this.lotRepo.countMatching({ status: "draft" }),
      this.lotRepo.countMatching({
        status: "active",
        endingWithinHours: LOTS_ENDING_SOON_HOURS,
      }),
    ]);

    const needsAttentionCount = draftMissingPhotos + withdrawalsPending;
    const publishedCount = Math.max(0, lensAll - draftCount);

    return {
      liveCount,
      draftCount,
      endingSoonCount,
      needsAttentionCount,
      endedCount,
      publishedCount,
      totalHammerValue: hammer.total,
      lensCounts: {
        all: lensAll,
        live: lensLive,
        draft: lensDraft,
        ending: lensEnding,
        attention: needsAttentionCount,
      },
    };
  }
}
