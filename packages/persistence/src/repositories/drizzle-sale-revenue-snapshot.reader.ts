import type { Database } from "@auction/db";
import { saleNotDeleted } from "@auction/db";
import { sale } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  ISaleRevenueSnapshotReader,
  SaleRevenueSnapshotData,
} from "../interfaces/sale-revenue-snapshot.reader.js";
import {
  listSaleLotRevenuePrices,
  sumSaleLotHammerPence,
} from "./sale/sale-overview-kpi-trend-queries.js";

export class DrizzleSaleRevenueSnapshotReader implements ISaleRevenueSnapshotReader {
  constructor(private readonly db: Database) {}

  async loadSnapshot(saleId: string): Promise<SaleRevenueSnapshotData | null> {
    const [saleRow] = await this.db
      .select({
        buyerPremiumRate: sale.buyerPremiumRate,
        buyerPremiumTiers: sale.buyerPremiumTiers,
      })
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);

    if (!saleRow) return null;

    const [lots, hammer] = await Promise.all([
      listSaleLotRevenuePrices(this.db, saleId),
      sumSaleLotHammerPence(this.db, saleId),
    ]);

    return {
      sale: {
        buyerPremiumRate: saleRow.buyerPremiumRate ?? "0",
        buyerPremiumTiers: saleRow.buyerPremiumTiers ?? null,
      },
      lots,
      totalHammerPence: hammer.totalPence,
    };
  }
}
