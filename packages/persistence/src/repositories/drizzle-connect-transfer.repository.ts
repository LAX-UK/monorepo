import type { Database } from "@auction/db";
import { legalEntity, payment } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  ConnectTransferLegalEntity,
  IConnectTransferRepository,
} from "../interfaces/connect-transfer.repository.js";

export class DrizzleConnectTransferRepository implements IConnectTransferRepository {
  constructor(private readonly db: Database) {}

  async findLegalEntityById(legalEntityId: string): Promise<ConnectTransferLegalEntity | null> {
    const rows = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findStripeChargeIdByPaymentId(paymentId: string): Promise<string | null> {
    const rows = await this.db
      .select({ stripeChargeId: payment.stripeChargeId })
      .from(payment)
      .where(eq(payment.id, paymentId))
      .limit(1);
    const chargeId = rows[0]?.stripeChargeId;
    return chargeId && chargeId.length > 0 ? chargeId : null;
  }
}
