import { minorUnitsToMoneyString } from "@auction/domain";
import type {
  IAdminDomainEventReader,
  IExportJobRepository,
  ILotRepository,
  ISaleRevenueSnapshotReader,
  RedactedDomainEventRow,
} from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { computeSaleExpectedRevenue } from "@auction/validators";
import { formatAdminRelativeTimeLabel } from "../../lib/format-admin-relative-time.js";

export type AdminSaleDetailMetrics = {
  lotCount: number;
  publishedLotCount: number;
  aggregateEstimate: string | null;
  aggregateEstimateDeltaHint: string | null;
  totalHammer: string | null;
  expectedRevenue: string | null;
  expectedRevenueHint: string | null;
  activeBidders: number | null;
  activeBiddersHint: string | null;
  bidActivityOnline: number | null;
  bidActivityRoom: number | null;
  bidActivityPhone: number | null;
  lastCatalogueSyncLabel: string | null;
  lastExportLabel: string | null;
  lastStatusChangeLabel: string | null;
};

export interface IAdminSaleDetailMetricsService {
  getMetrics(saleId: string): Promise<AdminSaleDetailMetrics>;
}

const SALE_STATUS_EVENT_PREFIXES = [
  "sale.published",
  "sale.unpublished",
  "sale.cancelled",
  "sale.ended",
  "sale.created",
] as const;

export class AdminSaleDetailMetricsService implements IAdminSaleDetailMetricsService {
  constructor(
    private readonly lotRepo: ILotRepository,
    private readonly revenueSnapshotReader: ISaleRevenueSnapshotReader,
    private readonly domainEventReader: IAdminDomainEventReader,
    private readonly exportJobRepo: IExportJobRepository,
  ) {}

  async getMetrics(saleId: string): Promise<AdminSaleDetailMetrics> {
    const [
      aggregate,
      bidSplit,
      activeBidders,
      revenueSnapshot,
      saleLots,
      saleEvents,
      latestExport,
    ] = await Promise.all([
      this.lotRepo.sumSaleLotEstimates(saleId),
      this.lotRepo.countSaleBidActivityByChannel(saleId),
      this.lotRepo.countActiveBiddersForSale(saleId),
      this.revenueSnapshotReader.loadSnapshot(saleId),
      this.lotRepo.findBySaleId(saleId),
      this.domainEventReader.listRedacted({
        limit: 100,
        aggregateType: "sale",
        aggregateId: saleId,
        includePii: false,
      }),
      this.exportJobRepo.findLatestCompletedForSale(saleId),
    ]);

    const totalHammer = revenueSnapshot
      ? minorUnitsToMoneyString(BigInt(revenueSnapshot.totalHammerPence))
      : null;
    const expectedRevenue = revenueSnapshot
      ? computeSaleExpectedRevenue({
          lots: revenueSnapshot.lots,
          sale: revenueSnapshot.sale,
        })
      : null;

    const latestCatalogueUpdate = saleLots.reduce<Date | null>((latest: Date | null, lot: Lot) => {
      const updatedAt = lot.updatedAt;
      if (!updatedAt) return latest;
      if (!latest || updatedAt.getTime() > latest.getTime()) return updatedAt;
      return latest;
    }, null);

    const statusEvents = saleEvents.filter((event: RedactedDomainEventRow) =>
      SALE_STATUS_EVENT_PREFIXES.some((prefix) => event.eventType === prefix),
    );
    const lastStatusEvent = statusEvents[statusEvents.length - 1];

    const publishedLotCount = saleLots.filter((lot: Lot) => lot.status !== "draft").length;

    return {
      lotCount: saleLots.length,
      publishedLotCount,
      aggregateEstimate: aggregate.total,
      aggregateEstimateDeltaHint: aggregate.count > 0 ? `${aggregate.count} lots priced` : null,
      totalHammer,
      expectedRevenue,
      expectedRevenueHint: "Incl. buyer's premium",
      activeBidders,
      activeBiddersHint: activeBidders > 0 ? "Bidding in session" : "No active bidders",
      bidActivityOnline: bidSplit.online,
      bidActivityRoom: bidSplit.room,
      bidActivityPhone: bidSplit.phone,
      lastCatalogueSyncLabel: formatAdminRelativeTimeLabel(latestCatalogueUpdate),
      lastExportLabel: formatAdminRelativeTimeLabel(latestExport?.completedAt ?? null),
      lastStatusChangeLabel: formatAdminRelativeTimeLabel(lastStatusEvent?.occurredAt ?? null),
    };
  }
}
