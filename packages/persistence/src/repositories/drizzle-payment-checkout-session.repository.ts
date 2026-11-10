import type { Database } from "@auction/db";
import { paymentCheckoutSession } from "@auction/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import type {
  CheckoutSessionRail,
  IPaymentCheckoutSessionStore,
  RecordedCheckoutSession,
} from "../interfaces/payment-checkout-session.store.js";

export class DrizzlePaymentCheckoutSessionRepository implements IPaymentCheckoutSessionStore {
  constructor(private readonly db: Database) {}

  async record(
    paymentId: string,
    stripeSessionId: string,
    detail?: { rail: CheckoutSessionRail; parametersFingerprint: string },
  ): Promise<void> {
    await this.db
      .insert(paymentCheckoutSession)
      .values({
        paymentId,
        stripeSessionId,
        rail: detail?.rail ?? null,
        parametersFingerprint: detail?.parametersFingerprint ?? null,
      })
      .onConflictDoNothing({ target: paymentCheckoutSession.stripeSessionId });
  }

  async listSessionIds(paymentId: string): Promise<string[]> {
    const rows = await this.listSessions(paymentId);
    return rows.map((row) => row.stripeSessionId);
  }

  async listSessions(paymentId: string): Promise<RecordedCheckoutSession[]> {
    const rows = await this.db
      .select({
        stripeSessionId: paymentCheckoutSession.stripeSessionId,
        rail: paymentCheckoutSession.rail,
        parametersFingerprint: paymentCheckoutSession.parametersFingerprint,
        closedAt: paymentCheckoutSession.closedAt,
      })
      .from(paymentCheckoutSession)
      .where(eq(paymentCheckoutSession.paymentId, paymentId))
      .orderBy(asc(paymentCheckoutSession.createdAt), asc(paymentCheckoutSession.stripeSessionId));
    return rows.map((row) => ({
      ...row,
      rail: row.rail === "card" || row.rail === "bank" ? row.rail : null,
    }));
  }

  async markClosed(stripeSessionId: string): Promise<void> {
    await this.db
      .update(paymentCheckoutSession)
      .set({ closedAt: new Date() })
      .where(
        and(
          eq(paymentCheckoutSession.stripeSessionId, stripeSessionId),
          isNull(paymentCheckoutSession.closedAt),
        ),
      );
  }
}
