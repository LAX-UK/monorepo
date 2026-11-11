import type { Database } from "@auction/db";
import { paymentTransferReference } from "@auction/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type {
  IPaymentTransferReferenceStore,
  TransferReferenceRecord,
} from "../interfaces/payment-transfer-reference.store.js";

const columns = {
  stripePaymentIntentId: paymentTransferReference.stripePaymentIntentId,
  reference: paymentTransferReference.reference,
  paymentId: paymentTransferReference.paymentId,
  paymentGroupId: paymentTransferReference.paymentGroupId,
};

export class DrizzlePaymentTransferReferenceRepository implements IPaymentTransferReferenceStore {
  constructor(private readonly db: Database) {}

  async remember(record: TransferReferenceRecord): Promise<void> {
    await this.db
      .insert(paymentTransferReference)
      .values(record)
      .onConflictDoNothing({ target: paymentTransferReference.stripePaymentIntentId });
  }

  async findByPaymentIntent(
    stripePaymentIntentId: string,
  ): Promise<TransferReferenceRecord | null> {
    const [row] = await this.db
      .select(columns)
      .from(paymentTransferReference)
      .where(eq(paymentTransferReference.stripePaymentIntentId, stripePaymentIntentId))
      .limit(1);
    return row ?? null;
  }

  async findByReference(reference: string): Promise<TransferReferenceRecord | null> {
    const [row] = await this.db
      .select(columns)
      .from(paymentTransferReference)
      .where(sql`upper(${paymentTransferReference.reference}) = ${reference.trim().toUpperCase()}`)
      .orderBy(asc(paymentTransferReference.createdAt))
      .limit(1);
    return row ?? null;
  }
}
