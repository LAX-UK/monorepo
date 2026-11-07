import type { Database } from "@auction/db";
import { paymentCheckoutSession } from "@auction/db/schema";
import { asc, eq } from "drizzle-orm";
import type { IPaymentCheckoutSessionStore } from "../interfaces/payment-checkout-session.store.js";

export class DrizzlePaymentCheckoutSessionRepository implements IPaymentCheckoutSessionStore {
  constructor(private readonly db: Database) {}

  async record(paymentId: string, stripeSessionId: string): Promise<void> {
    await this.db
      .insert(paymentCheckoutSession)
      .values({ paymentId, stripeSessionId })
      .onConflictDoNothing({ target: paymentCheckoutSession.stripeSessionId });
  }

  async listSessionIds(paymentId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: paymentCheckoutSession.stripeSessionId })
      .from(paymentCheckoutSession)
      .where(eq(paymentCheckoutSession.paymentId, paymentId))
      .orderBy(asc(paymentCheckoutSession.createdAt));
    return rows.map((row) => row.id);
  }
}
