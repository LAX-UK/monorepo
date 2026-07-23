import type { Database } from "@auction/db";
import { saleNotDeleted } from "@auction/db";
import { sale } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  ISaleOverviewKpiTrendReader,
  SaleOverviewKpiDailySignals,
} from "../interfaces/sale-overview-kpi-trend.reader.js";
import {
  countSaleDistinctBiddersByDay,
  countSaleLotsAddedByDay,
  countSaleRegistrationsByDay,
  sumSaleBidAmountByDayAndLot,
  sumSaleBidAmountByDayPence,
  sumSaleEstimateAddedByDayPence,
} from "./sale/sale-overview-kpi-trend-queries.js";

export class DrizzleSaleOverviewKpiTrendReader implements ISaleOverviewKpiTrendReader {
  constructor(private readonly db: Database) {}

  async loadAllSignals(saleId: string, rangeStart: Date): Promise<SaleOverviewKpiDailySignals> {
    const [saleRow] = await this.db
      .select({ id: sale.id })
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);

    if (!saleRow) {
      return {
        lotsAddedByDay: new Map(),
        estimateAddedByDayPence: new Map(),
        bidAmountByDayPence: new Map(),
        registrationsByDay: new Map(),
        distinctBiddersByDay: new Map(),
        bidVolumeByDayAndLot: [],
      };
    }

    const [
      lotsAddedByDay,
      estimateAddedByDayPence,
      bidAmountByDayPence,
      registrationsByDay,
      distinctBiddersByDay,
      bidVolumeByDayAndLot,
    ] = await Promise.all([
      countSaleLotsAddedByDay(this.db, saleId, rangeStart),
      sumSaleEstimateAddedByDayPence(this.db, saleId, rangeStart),
      sumSaleBidAmountByDayPence(this.db, saleId, rangeStart),
      countSaleRegistrationsByDay(this.db, saleId, rangeStart),
      countSaleDistinctBiddersByDay(this.db, saleId, rangeStart),
      sumSaleBidAmountByDayAndLot(this.db, saleId, rangeStart),
    ]);

    return {
      lotsAddedByDay,
      estimateAddedByDayPence,
      bidAmountByDayPence,
      registrationsByDay,
      distinctBiddersByDay,
      bidVolumeByDayAndLot,
    };
  }
}
