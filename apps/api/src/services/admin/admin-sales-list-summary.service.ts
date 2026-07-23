import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";

export type AdminSalesLensCounts = {
  all: number;
  upcoming: number;
  live: number;
  closed: number;
  settled: number;
  setup: number;
};

export type AdminSalesListSummary = {
  activeCount: number;
  upcomingCount: number;
  draftCount: number;
  completedCount: number;
  avgLotsPerSale: number;
  totalHammerValue: string;
  lensCounts: AdminSalesLensCounts;
};

export class AdminSalesListSummaryService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
  ) {}

  async getSummary(): Promise<AdminSalesListSummary> {
    const [
      activeCount,
      upcomingCount,
      draftCount,
      completedCount,
      avgLotsPerSale,
      hammer,
      lensAll,
      lensUpcoming,
      lensLive,
      lensClosed,
      lensSettled,
      lensSetup,
    ] = await Promise.all([
      this.saleRepo.countMatching({ status: "active" }),
      this.saleRepo.countMatching({ status: "scheduled" }),
      this.saleRepo.countMatching({ status: "draft" }),
      this.saleRepo.countMatching({ status: "ended", settlementStatus: "settled" }),
      this.saleRepo.avgLotsPerSale(),
      this.lotRepo.sumEndedHammer({}),
      this.saleRepo.countMatching({}),
      this.saleRepo.countMatching({ status: "scheduled" }),
      this.saleRepo.countMatching({ status: "active" }),
      this.saleRepo.countMatching({ status: "ended", settlementStatus: "unsettled" }),
      this.saleRepo.countMatching({ status: "ended", settlementStatus: "settled" }),
      this.saleRepo.countMatching({ needsSetup: true }),
    ]);

    return {
      activeCount,
      upcomingCount,
      draftCount,
      completedCount,
      avgLotsPerSale,
      totalHammerValue: hammer.total,
      lensCounts: {
        all: lensAll,
        upcoming: lensUpcoming,
        live: lensLive,
        closed: lensClosed,
        settled: lensSettled,
        setup: lensSetup,
      },
    };
  }
}
