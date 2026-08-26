import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import {
  lot,
  sale,
  saleRegistration,
  saleroomSession,
  telephoneBidBooking,
} from "@auction/db/schema";
import { and, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import type {
  AdminSaleReadinessSourceRow,
  IAdminSaleReadinessReader,
} from "../interfaces/admin-sale-readiness.reader.js";

export class DrizzleAdminSaleReadinessReader implements IAdminSaleReadinessReader {
  constructor(private readonly db: Database) {}

  async listUpcomingAndLiveSales(limit: number): Promise<AdminSaleReadinessSourceRow[]> {
    const sales = await this.db
      .select({
        id: sale.id,
        title: sale.title,
        status: sale.status,
        deliveryMode: sale.deliveryMode,
        startTime: sale.startTime,
      })
      .from(sale)
      .where(
        and(
          saleNotDeleted(),
          inArray(sale.status, ["draft", "scheduled", "active"]),
          or(isNull(sale.startTime), gte(sale.startTime, sql`now() - interval '7 days'`)),
        ),
      )
      .orderBy(sql`${sale.startTime} ASC NULLS LAST`)
      .limit(limit);

    if (sales.length === 0) return [];

    const saleIds = sales.map((s) => s.id);

    const [lotStats, regCounts, telCounts, sessions] = await Promise.all([
      this.db
        .select({
          saleId: lot.saleId,
          total: sql<number>`count(*)::int`,
          published: sql<number>`count(*) filter (where ${lot.status} = 'active')::int`,
          draft: sql<number>`count(*) filter (where ${lot.status} = 'draft')::int`,
          missingPhotos: sql<number>`count(*) filter (where coalesce(array_length(${lot.images}, 1), 0) = 0)::int`,
          missingEstimates: sql<number>`count(*) filter (where coalesce(${lot.marketingDetails}->>'estimateLow', '') = '' and coalesce(${lot.marketingDetails}->>'estimateHigh', '') = '')::int`,
        })
        .from(lot)
        .where(and(inArray(lot.saleId, saleIds), lotNotDeleted()))
        .groupBy(lot.saleId),
      this.db
        .select({
          saleId: saleRegistration.saleId,
          count: sql<number>`count(*)::int`,
        })
        .from(saleRegistration)
        .where(
          and(inArray(saleRegistration.saleId, saleIds), eq(saleRegistration.status, "pending")),
        )
        .groupBy(saleRegistration.saleId),
      this.db
        .select({
          saleId: telephoneBidBooking.saleId,
          count: sql<number>`count(*)::int`,
        })
        .from(telephoneBidBooking)
        .where(
          and(
            inArray(telephoneBidBooking.saleId, saleIds),
            eq(telephoneBidBooking.status, "requested"),
          ),
        )
        .groupBy(telephoneBidBooking.saleId),
      this.db
        .select({
          saleId: saleroomSession.saleId,
          status: saleroomSession.status,
        })
        .from(saleroomSession)
        .where(inArray(saleroomSession.saleId, saleIds)),
    ]);

    const lotBySale = new Map(lotStats.map((r) => [r.saleId, r]));
    const regBySale = new Map(regCounts.map((r) => [r.saleId, r.count]));
    const telBySale = new Map(telCounts.map((r) => [r.saleId, r.count]));
    const sessionBySale = new Map(sessions.map((r) => [r.saleId, r.status]));

    return sales.map((s) => {
      const stats = lotBySale.get(s.id);
      return {
        saleId: s.id,
        title: s.title,
        status: s.status,
        deliveryMode: s.deliveryMode,
        startTime: s.startTime,
        lotsTotal: stats?.total ?? 0,
        lotsPublished: stats?.published ?? 0,
        lotsDraft: stats?.draft ?? 0,
        lotsMissingPhotos: stats?.missingPhotos ?? 0,
        lotsMissingEstimates: stats?.missingEstimates ?? 0,
        pendingRegistrations: regBySale.get(s.id) ?? 0,
        pendingTelephoneBookings: telBySale.get(s.id) ?? 0,
        sessionStatus: sessionBySale.get(s.id) ?? null,
      };
    });
  }
}
