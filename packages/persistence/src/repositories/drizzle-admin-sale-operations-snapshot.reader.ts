import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { bid, lot, sale, saleroomSession } from "@auction/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type {
  AdminSaleOperationsCurrentLotBidding,
  AdminSaleOperationsCurrentLotRow,
  AdminSaleOperationsSaleRow,
  AdminSaleOperationsSessionRow,
  IAdminSaleOperationsSnapshotReader,
} from "../interfaces/admin-sale-operations-snapshot.reader.js";

export class DrizzleAdminSaleOperationsSnapshotReader
  implements IAdminSaleOperationsSnapshotReader
{
  constructor(private readonly db: Database) {}

  async findSaleroomSale(saleId: string): Promise<AdminSaleOperationsSaleRow | null> {
    const [saleRow] = await this.db
      .select({
        id: sale.id,
        title: sale.title,
        status: sale.status,
        deliveryMode: sale.deliveryMode,
        startTime: sale.startTime,
        locationName: sale.locationName,
        streamUrl: sale.streamUrl,
      })
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);
    return saleRow ?? null;
  }

  async findSession(saleId: string): Promise<AdminSaleOperationsSessionRow | null> {
    const [session] = await this.db
      .select({
        status: saleroomSession.status,
        currentLotId: saleroomSession.currentLotId,
      })
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, saleId))
      .limit(1);
    return session ?? null;
  }

  async findCurrentLot(lotId: string): Promise<AdminSaleOperationsCurrentLotRow | null> {
    const [lotRow] = await this.db
      .select({
        lotNumber: lot.lotNumber,
        title: lot.title,
        currentPrice: lot.currentPrice,
      })
      .from(lot)
      .where(and(eq(lot.id, lotId), lotNotDeleted()))
      .limit(1);
    if (!lotRow) return null;
    return {
      lotNumber: lotRow.lotNumber,
      title: lotRow.title,
      currentPrice: String(lotRow.currentPrice),
    };
  }

  async loadCurrentLotBidding(lotId: string): Promise<AdminSaleOperationsCurrentLotBidding | null> {
    const lotRow = await this.findCurrentLot(lotId);
    if (!lotRow) return null;
    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bid)
      .where(eq(bid.lotId, lotId));
    const [winner] = await this.db
      .select({ bidderId: bid.bidderId })
      .from(bid)
      .where(and(eq(bid.lotId, lotId), eq(bid.isWinning, true)))
      .limit(1);
    return {
      currentPrice: lotRow.currentPrice,
      leaderRef: winner?.bidderId ?? null,
      bidCount: countRow?.count ?? 0,
    };
  }
}
