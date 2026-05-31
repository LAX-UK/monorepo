import type { Database } from "@auction/db";
import { lot, lotFulfilment } from "@auction/db/schema";
import { and, count, desc, eq, getTableColumns, ilike, or } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import type { LotFulfilmentAddressSnapshot } from "./interfaces/lot-fulfilment-payment-hook.js";

export type LotFulfilmentRow = typeof lotFulfilment.$inferSelect;

export type LotFulfilmentListRow = LotFulfilmentRow & { lotTitle: string | null };

export type LotFulfilmentServiceError = { message: string; status: number; code?: string };

export class LotFulfilmentService {
  constructor(private readonly db: Database) {}

  /** Called when a pending payment exists for the lot (create or reuse). */
  async ensureAwaitingPayment(
    lotId: string,
    paymentId: string,
    addressSnapshot?: LotFulfilmentAddressSnapshot | null,
  ): Promise<void> {
    const snapshotJson = addressSnapshot ?? null;
    const [existing] = await this.db
      .select()
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lotId))
      .limit(1);
    if (!existing) {
      await this.db.insert(lotFulfilment).values({
        lotId,
        paymentId,
        status: "awaiting_payment",
        ...(snapshotJson ? { addressSnapshot: snapshotJson } : {}),
      });
      return;
    }
    if (existing.status === "awaiting_payment") {
      await this.db
        .update(lotFulfilment)
        .set({
          paymentId,
          updatedAt: new Date(),
          ...(snapshotJson ? { addressSnapshot: snapshotJson } : {}),
        })
        .where(eq(lotFulfilment.lotId, lotId));
    }
  }

  /** Called after payment is captured (Stripe / Xero / admin). */
  async onPaymentCaptured(lotId: string, paymentId: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lotId))
      .limit(1);
    if (!row) {
      await this.db.insert(lotFulfilment).values({
        lotId,
        paymentId,
        status: "awaiting_release",
      });
      return;
    }
    if (row.status === "awaiting_payment" || row.status === "awaiting_release") {
      await this.db
        .update(lotFulfilment)
        .set({
          paymentId,
          status: "awaiting_release",
          updatedAt: new Date(),
        })
        .where(eq(lotFulfilment.lotId, lotId));
    }
  }

  async getForWinner(
    userId: string,
    lotId: string,
  ): Promise<Result<LotFulfilmentRow | null, LotFulfilmentServiceError>> {
    const [l] = await this.db
      .select({ winnerId: lot.winnerId })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    if (!l) return err({ message: "Lot not found", status: 404 });
    if (l.winnerId !== userId) {
      return err({
        message: "Only the winning bidder can view fulfilment for this lot",
        status: 403,
      });
    }
    const [row] = await this.db
      .select()
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lotId))
      .limit(1);
    return ok(row ?? null);
  }

  async listForAdmin(options?: {
    status?: LotFulfilmentRow["status"];
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: LotFulfilmentListRow[];
    total: number;
    statusCounts: Record<string, number>;
  }> {
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const offset = Math.max(0, options?.offset ?? 0);
    const needle = options?.q?.trim();
    const needleIsUuid =
      needle != null &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(needle);
    const filters = [
      ...(options?.status !== undefined ? [eq(lotFulfilment.status, options.status)] : []),
      ...(needle
        ? [
            or(
              ilike(lot.title, `%${needle}%`),
              ...(needleIsUuid
                ? [eq(lotFulfilment.lotId, needle), eq(lotFulfilment.id, needle)]
                : []),
            ),
          ]
        : []),
    ];
    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const countBase = this.db
      .select({ n: count() })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lotFulfilment.lotId, lot.id));
    const [totalRow] = whereClause ? await countBase.where(whereClause) : await countBase;
    const total = Number(totalRow?.n ?? 0);

    const statusCountBase = this.db
      .select({ status: lotFulfilment.status, n: count() })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lotFulfilment.lotId, lot.id))
      .groupBy(lotFulfilment.status);
    const statusRows = whereClause
      ? await statusCountBase.where(whereClause)
      : await statusCountBase;
    const statusCounts = Object.fromEntries(
      statusRows.map((row) => [row.status, Number(row.n ?? 0)]),
    );

    const listBase = this.db
      .select({
        ...getTableColumns(lotFulfilment),
        lotTitle: lot.title,
      })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lotFulfilment.lotId, lot.id))
      .orderBy(desc(lotFulfilment.updatedAt))
      .limit(limit)
      .offset(offset);
    const rows = whereClause ? await listBase.where(whereClause) : await listBase;
    const items = rows.map((r) => {
      const { lotTitle: title, ...rest } = r;
      return { ...rest, lotTitle: title };
    });

    return { items, total, statusCounts };
  }

  async getByLotIdForAdmin(lotId: string): Promise<LotFulfilmentRow | null> {
    const [row] = await this.db
      .select()
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lotId))
      .limit(1);
    return row ?? null;
  }

  async approveRelease(input: {
    lotId: string;
    actorUserId: string;
    notes?: string | undefined;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    return this.transition(input.lotId, "awaiting_release", async (row) => {
      await this.db
        .update(lotFulfilment)
        .set({
          status: "released",
          releaseApprovedByUserId: input.actorUserId,
          releaseApprovedAt: new Date(),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(lotFulfilment.id, row.id));
    });
  }

  async markShipped(input: {
    lotId: string;
    actorUserId: string;
    carrier: string;
    trackingNumber: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    return this.transition(input.lotId, "released", async (row) => {
      await this.db
        .update(lotFulfilment)
        .set({
          status: "in_transit",
          fulfilmentMethod: "shipping",
          shippingCarrier: input.carrier,
          trackingNumber: input.trackingNumber,
          updatedAt: new Date(),
        })
        .where(eq(lotFulfilment.id, row.id));
    });
  }

  async markReadyForCollection(input: {
    lotId: string;
    actorUserId: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(input.lotId, "released", async (row) => {
      await this.db
        .update(lotFulfilment)
        .set({
          status: "ready_for_collection",
          fulfilmentMethod: "collection",
          updatedAt: new Date(),
        })
        .where(eq(lotFulfilment.id, row.id));
    });
  }

  async markDelivered(input: {
    lotId: string;
    actorUserId: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(input.lotId, "in_transit", async (row) => {
      await this.db
        .update(lotFulfilment)
        .set({
          status: "delivered",
          updatedAt: new Date(),
        })
        .where(eq(lotFulfilment.id, row.id));
    });
  }

  async markCollected(input: {
    lotId: string;
    actorUserId: string;
    collectedBy: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(input.lotId, "ready_for_collection", async (row) => {
      await this.db
        .update(lotFulfilment)
        .set({
          status: "delivered",
          collectedBy: input.collectedBy,
          collectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(lotFulfilment.id, row.id));
    });
  }

  private async transition(
    lotId: string,
    requiredStatus: LotFulfilmentRow["status"],
    patch: (row: LotFulfilmentRow) => Promise<void>,
  ): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    const [row] = await this.db
      .select()
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lotId))
      .limit(1);
    if (!row) {
      return err({
        message: "No fulfilment record for this lot",
        status: 404,
        code: "no_fulfilment",
      });
    }
    if (row.status !== requiredStatus) {
      return err({
        message: `Lot must be in status "${requiredStatus}" (currently "${row.status}")`,
        status: 400,
        code: "invalid_status",
      });
    }
    await patch(row);
    const [next] = await this.db
      .select()
      .from(lotFulfilment)
      .where(eq(lotFulfilment.lotId, lotId))
      .limit(1);
    return next ? ok(next) : err({ message: "Fulfilment row missing after update", status: 500 });
  }
}
