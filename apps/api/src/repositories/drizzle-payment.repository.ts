import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type {
  CreatePaymentRow,
  IPaymentWriteRepository,
  PaymentRecord,
} from "../services/interfaces/payment-write.js";

type Row = InferSelectModel<typeof payment>;

function mapRow(row: Row): PaymentRecord {
  return {
    id: row.id,
    lotId: row.lotId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    amount: String(row.amount),
    platformFee: String(row.platformFee),
    stripePaymentIntentId: row.stripePaymentIntentId,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export class DrizzlePaymentRepository implements IPaymentWriteRepository {
  constructor(private readonly db: Database) {}

  async create(row: CreatePaymentRow): Promise<PaymentRecord> {
    const [created] = await this.db
      .insert(payment)
      .values({
        lotId: row.lotId,
        buyerId: row.buyerId,
        sellerId: row.sellerId,
        amount: row.amount,
        platformFee: row.platformFee,
        stripePaymentIntentId: row.stripePaymentIntentId,
        status: "pending",
      })
      .returning();
    if (!created) throw new Error("Payment insert failed");
    return mapRow(created);
  }

  async findById(id: string): Promise<PaymentRecord | null> {
    const rows = await this.db.select().from(payment).where(eq(payment.id, id)).limit(1);
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async findOpenByLotAndBuyer(lotId: string, buyerId: string): Promise<PaymentRecord | null> {
    const rows = await this.db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.lotId, lotId),
          eq(payment.buyerId, buyerId),
          inArray(payment.status, ["pending", "authorized", "captured"]),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async updateStatus(id: string, status: PaymentRecord["status"]): Promise<void> {
    await this.db.update(payment).set({ status }).where(eq(payment.id, id));
  }

  async listAll(): Promise<PaymentRecord[]> {
    const rows = await this.db.select().from(payment).orderBy(desc(payment.createdAt));
    return rows.map(mapRow);
  }

  async listByBuyerId(buyerId: string): Promise<PaymentRecord[]> {
    const rows = await this.db
      .select()
      .from(payment)
      .where(eq(payment.buyerId, buyerId))
      .orderBy(desc(payment.createdAt));
    return rows.map(mapRow);
  }

  async countPendingOlderThanHours(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 3_600_000);
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payment)
      .where(and(eq(payment.status, "pending"), lte(payment.createdAt, cutoff)));
    return row?.n ?? 0;
  }

  async sumCapturedBetween(start: Date, end: Date): Promise<string> {
    const [row] = await this.db
      .select({ s: sql<string>`coalesce(sum(${payment.amount}), 0)::text` })
      .from(payment)
      .where(
        and(eq(payment.status, "captured"), gte(payment.createdAt, start), lte(payment.createdAt, end)),
      );
    return row?.s ?? "0";
  }
}
