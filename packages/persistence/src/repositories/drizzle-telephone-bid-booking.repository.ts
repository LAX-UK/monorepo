import type { Database } from "@auction/db";
import { legalEntity, telephoneBidBooking, user } from "@auction/db/schema";
import type { TelephoneBidBookingStatus } from "@auction/types";
import { and, arrayContains, desc, eq, inArray, or, sql } from "drizzle-orm";
import type {
  ITelephoneBidBookingRepository,
  InsertTelephoneBidBookingRow,
  TelephoneBidBookingAdminRow,
  TelephoneBidBookingRow,
} from "../interfaces/telephone-bid-booking.repository.js";
import { mapTelephoneBidBookingRow } from "../lib/telephone-booking.mapper.js";

const ACTIVE_STATUSES: TelephoneBidBookingStatus[] = ["requested", "confirmed", "in_progress"];

function mapAdminRow(row: {
  booking: typeof telephoneBidBooking.$inferSelect;
  userEmail: string | null;
  userName: string | null;
  buyerLegalEntityDisplayName: string | null;
}): TelephoneBidBookingAdminRow {
  return {
    ...mapTelephoneBidBookingRow(row.booking),
    userEmail: row.userEmail,
    userName: row.userName,
    buyerLegalEntityDisplayName: row.buyerLegalEntityDisplayName,
  };
}

export class DrizzleTelephoneBidBookingRepository implements ITelephoneBidBookingRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<TelephoneBidBookingRow | null> {
    const [row] = await this.db
      .select()
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.id, id))
      .limit(1);
    return row ? mapTelephoneBidBookingRow(row) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<TelephoneBidBookingRow | null> {
    const [row] = await this.db
      .select()
      .from(telephoneBidBooking)
      .where(and(eq(telephoneBidBooking.id, id), eq(telephoneBidBooking.userId, userId)))
      .limit(1);
    return row ? mapTelephoneBidBookingRow(row) : null;
  }

  async findActiveForSaleUserEntity(input: {
    saleId: string;
    userId: string;
    buyerLegalEntityId: string;
  }): Promise<TelephoneBidBookingRow | null> {
    const [row] = await this.db
      .select()
      .from(telephoneBidBooking)
      .where(
        and(
          eq(telephoneBidBooking.saleId, input.saleId),
          eq(telephoneBidBooking.userId, input.userId),
          eq(telephoneBidBooking.buyerLegalEntityId, input.buyerLegalEntityId),
          inArray(telephoneBidBooking.status, ACTIVE_STATUSES),
        ),
      )
      .limit(1);
    return row ? mapTelephoneBidBookingRow(row) : null;
  }

  async findMineForSale(saleId: string, userId: string): Promise<TelephoneBidBookingRow | null> {
    const [row] = await this.db
      .select()
      .from(telephoneBidBooking)
      .where(
        and(
          eq(telephoneBidBooking.saleId, saleId),
          eq(telephoneBidBooking.userId, userId),
          inArray(telephoneBidBooking.status, ACTIVE_STATUSES),
        ),
      )
      .orderBy(desc(telephoneBidBooking.createdAt))
      .limit(1);
    return row ? mapTelephoneBidBookingRow(row) : null;
  }

  async listMineForUser(userId: string): Promise<TelephoneBidBookingRow[]> {
    const rows = await this.db
      .select()
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.userId, userId))
      .orderBy(desc(telephoneBidBooking.updatedAt));
    return rows.map(mapTelephoneBidBookingRow);
  }

  private adminSelect() {
    return this.db
      .select({
        booking: telephoneBidBooking,
        userEmail: user.email,
        userName: user.name,
        buyerLegalEntityDisplayName: legalEntity.displayName,
      })
      .from(telephoneBidBooking)
      .leftJoin(user, eq(telephoneBidBooking.userId, user.id))
      .leftJoin(legalEntity, eq(telephoneBidBooking.buyerLegalEntityId, legalEntity.id));
  }

  async listForSaleAdmin(
    saleId: string,
    status?: TelephoneBidBookingStatus,
  ): Promise<TelephoneBidBookingAdminRow[]> {
    const conditions = [eq(telephoneBidBooking.saleId, saleId)];
    if (status) {
      conditions.push(eq(telephoneBidBooking.status, status));
    }
    const rows = await this.adminSelect()
      .where(and(...conditions))
      .orderBy(desc(telephoneBidBooking.createdAt));
    return rows.map(mapAdminRow);
  }

  async listForCurrentLot(saleId: string, lotId: string): Promise<TelephoneBidBookingAdminRow[]> {
    const rows = await this.adminSelect()
      .where(
        and(
          eq(telephoneBidBooking.saleId, saleId),
          inArray(telephoneBidBooking.status, ["confirmed", "in_progress"]),
          or(
            sql`cardinality(${telephoneBidBooking.lotIds}) = 0`,
            arrayContains(telephoneBidBooking.lotIds, [lotId]),
          ),
        ),
      )
      .orderBy(desc(telephoneBidBooking.updatedAt));
    return rows.map(mapAdminRow);
  }

  async insert(row: InsertTelephoneBidBookingRow): Promise<TelephoneBidBookingRow> {
    const [inserted] = await this.db
      .insert(telephoneBidBooking)
      .values({
        saleId: row.saleId,
        userId: row.userId,
        buyerLegalEntityId: row.buyerLegalEntityId,
        phoneE164: row.phoneE164,
        lotIds: row.lotIds ?? [],
        reserveAltMax: row.authorizedMax ?? null,
        buyerNotes: row.buyerNotes ?? null,
        status: "requested",
      })
      .returning();
    if (!inserted) {
      throw new Error("telephone_bid_booking_insert_failed");
    }
    return mapTelephoneBidBookingRow(inserted);
  }

  async update(
    id: string,
    patch: Partial<{
      lotIds: string[];
      authorizedMax: string | null;
      status: TelephoneBidBookingStatus;
      clerkUserId: string | null;
      notes: string | null;
      approvedByUserId: string | null;
      confirmedAt: Date | null;
      completedLotIds: string[];
      limitIncreaseRequestedAt: Date | null;
      limitIncreaseAmount: string | null;
      cancelledAt: Date | null;
      cancelledByUserId: string | null;
      cancellationReason: string | null;
    }>,
  ): Promise<TelephoneBidBookingRow | null> {
    const values: Partial<typeof telephoneBidBooking.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.lotIds !== undefined) values.lotIds = patch.lotIds;
    if (patch.authorizedMax !== undefined) values.reserveAltMax = patch.authorizedMax;
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.clerkUserId !== undefined) values.clerkUserId = patch.clerkUserId;
    if (patch.notes !== undefined) values.notes = patch.notes;
    if (patch.approvedByUserId !== undefined) values.approvedByUserId = patch.approvedByUserId;
    if (patch.confirmedAt !== undefined) values.confirmedAt = patch.confirmedAt;
    if (patch.completedLotIds !== undefined) values.completedLotIds = patch.completedLotIds;
    if (patch.limitIncreaseRequestedAt !== undefined) {
      values.limitIncreaseRequestedAt = patch.limitIncreaseRequestedAt;
    }
    if (patch.limitIncreaseAmount !== undefined) {
      values.limitIncreaseAmount = patch.limitIncreaseAmount;
    }
    if (patch.cancelledAt !== undefined) values.cancelledAt = patch.cancelledAt;
    if (patch.cancelledByUserId !== undefined) values.cancelledByUserId = patch.cancelledByUserId;
    if (patch.cancellationReason !== undefined)
      values.cancellationReason = patch.cancellationReason;

    const [row] = await this.db
      .update(telephoneBidBooking)
      .set(values)
      .where(eq(telephoneBidBooking.id, id))
      .returning();
    return row ? mapTelephoneBidBookingRow(row) : null;
  }

  async countBySaleStatus(saleId: string, status: TelephoneBidBookingStatus): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(telephoneBidBooking)
      .where(and(eq(telephoneBidBooking.saleId, saleId), eq(telephoneBidBooking.status, status)));
    return row?.count ?? 0;
  }

  async countGlobalByStatus(status: TelephoneBidBookingStatus): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.status, status));
    return row?.count ?? 0;
  }

  async closeAllOpenForSale(saleId: string): Promise<number> {
    const result = await this.db
      .update(telephoneBidBooking)
      .set({ status: "completed", updatedAt: new Date() })
      .where(
        and(
          eq(telephoneBidBooking.saleId, saleId),
          inArray(telephoneBidBooking.status, ["confirmed", "in_progress"]),
        ),
      )
      .returning({ id: telephoneBidBooking.id });
    return result.length;
  }

  async completeLinesForLot(saleId: string, lotId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(telephoneBidBooking)
      .where(
        and(eq(telephoneBidBooking.saleId, saleId), eq(telephoneBidBooking.status, "in_progress")),
      );
    let count = 0;
    for (const row of rows) {
      const lotIds = row.lotIds ?? [];
      const applies = lotIds.length === 0 || lotIds.includes(lotId);
      if (!applies) continue;
      const completed = [...(row.completedLotIds ?? [])];
      if (!completed.includes(lotId)) completed.push(lotId);
      await this.db
        .update(telephoneBidBooking)
        .set({
          status: "confirmed",
          completedLotIds: completed,
          updatedAt: new Date(),
        })
        .where(eq(telephoneBidBooking.id, row.id));
      count++;
    }
    return count;
  }

  async removeLotFromActiveBookings(saleId: string, lotId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(telephoneBidBooking)
      .where(
        and(
          eq(telephoneBidBooking.saleId, saleId),
          inArray(telephoneBidBooking.status, ACTIVE_STATUSES),
        ),
      );
    let count = 0;
    for (const row of rows) {
      const lotIds = (row.lotIds ?? []).filter((id) => id !== lotId);
      if (lotIds.length !== (row.lotIds ?? []).length) {
        await this.db
          .update(telephoneBidBooking)
          .set({ lotIds, updatedAt: new Date() })
          .where(eq(telephoneBidBooking.id, row.id));
        count++;
      }
    }
    return count;
  }
}
