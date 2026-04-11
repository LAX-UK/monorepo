import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
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
    auctionId: row.auctionId,
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
        auctionId: row.auctionId,
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
}
