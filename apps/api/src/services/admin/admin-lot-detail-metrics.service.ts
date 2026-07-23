import type { IBidRepository, ILotRepository } from "@auction/persistence/interfaces";

function formatBuyerPremiumLabel(rate: string | null | undefined): string | null {
  if (!rate?.trim()) return null;
  const pct = Number.parseFloat(rate);
  if (Number.isNaN(pct)) return rate;
  return `${Math.round(pct * 100)}%`;
}

export type AdminLotDetailMetrics = {
  currentHammer: string | null;
  startingPrice: string | null;
  estimateLow: string | null;
  estimateHigh: string | null;
  reservePrice: string | null;
  bidCount: number;
  uniqueBidders: number;
  reserveMet: boolean | null;
  buyerPremiumLabel: string | null;
  /** Public lot page views; null until analytics aggregate ships — see apps/web/src/lib/admin/README-lot-page-views.md */
  pageViewCount: number | null;
};

export interface IAdminLotDetailMetricsService {
  getMetrics(lotId: string): Promise<AdminLotDetailMetrics | null>;
}

export class AdminLotDetailMetricsService implements IAdminLotDetailMetricsService {
  constructor(
    private readonly lotRepo: ILotRepository,
    private readonly bidRepo: IBidRepository,
  ) {}

  async getMetrics(lotId: string): Promise<AdminLotDetailMetrics | null> {
    const lot = await this.lotRepo.findById(lotId);
    if (!lot) return null;

    const [bidCount, bidderIds] = await Promise.all([
      this.bidRepo.countForLot(lotId),
      this.bidRepo.listDistinctBidderIds(lotId),
    ]);

    const reserve = lot.reservePrice?.trim() || null;
    let reserveMet: boolean | null = null;
    if (reserve && bidCount > 0) {
      const current = Number.parseFloat(lot.currentPrice);
      const reserveNum = Number.parseFloat(reserve);
      reserveMet = !Number.isNaN(current) && !Number.isNaN(reserveNum) && current >= reserveNum;
    }

    const estimate = lot.marketingDetails?.estimate;

    return {
      currentHammer: lot.currentPrice ?? null,
      startingPrice: lot.startingPrice ?? null,
      estimateLow: estimate?.low ?? null,
      estimateHigh: estimate?.high ?? null,
      reservePrice: reserve,
      bidCount,
      uniqueBidders: bidderIds.length,
      reserveMet,
      buyerPremiumLabel: formatBuyerPremiumLabel(lot.buyerPremiumRate),
      pageViewCount: null,
    };
  }
}
