import type { Database } from "@auction/db";
import { paymentExternalRef } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  IPaymentExternalRefRepository,
  PaymentExternalRefRow,
  PaymentExternalSyncStatus,
} from "../services/interfaces/xero-repositories.js";

export class DrizzlePaymentExternalRefRepository implements IPaymentExternalRefRepository {
  constructor(private readonly db: Database) {}

  async insertPending(paymentId: string): Promise<PaymentExternalRefRow> {
    const now = new Date();
    const [row] = await this.db
      .insert(paymentExternalRef)
      .values({
        paymentId,
        syncStatus: "pending_sync",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) throw new Error("payment_external_ref insert failed");
    return row;
  }

  async findByPaymentId(paymentId: string): Promise<PaymentExternalRefRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentExternalRef)
      .where(eq(paymentExternalRef.paymentId, paymentId))
      .limit(1);
    return row ?? null;
  }

  async findByXeroInvoiceId(invoiceId: string): Promise<PaymentExternalRefRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentExternalRef)
      .where(eq(paymentExternalRef.xeroInvoiceId, invoiceId))
      .limit(1);
    return row ?? null;
  }

  async updateSuccess(
    paymentId: string,
    patch: {
      xeroInvoiceId: string;
      xeroInvoiceNumber: string | null;
      xeroContactId: string;
      onlineInvoiceUrl: string;
      syncStatus: PaymentExternalSyncStatus;
    },
  ): Promise<void> {
    await this.db
      .update(paymentExternalRef)
      .set({
        xeroInvoiceId: patch.xeroInvoiceId,
        xeroInvoiceNumber: patch.xeroInvoiceNumber,
        xeroContactId: patch.xeroContactId,
        onlineInvoiceUrl: patch.onlineInvoiceUrl,
        syncStatus: patch.syncStatus,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(paymentExternalRef.paymentId, paymentId));
  }

  async updateError(paymentId: string, message: string): Promise<void> {
    await this.db
      .update(paymentExternalRef)
      .set({
        syncStatus: "error",
        lastError: message,
        updatedAt: new Date(),
      })
      .where(eq(paymentExternalRef.paymentId, paymentId));
  }

  async updateXeroPaymentId(paymentId: string, xeroPaymentId: string | null): Promise<void> {
    await this.db
      .update(paymentExternalRef)
      .set({ xeroPaymentId, updatedAt: new Date() })
      .where(eq(paymentExternalRef.paymentId, paymentId));
  }

  async patchOnlineInvoiceUrl(paymentId: string, url: string): Promise<void> {
    await this.db
      .update(paymentExternalRef)
      .set({
        onlineInvoiceUrl: url,
        syncStatus: "synced",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(paymentExternalRef.paymentId, paymentId));
  }

  async updateInvoiceCreated(
    paymentId: string,
    patch: {
      xeroInvoiceId: string;
      xeroInvoiceNumber: string | null;
      xeroContactId: string;
      onlineInvoiceUrl?: string | null;
      syncStatus: PaymentExternalSyncStatus;
    },
  ): Promise<void> {
    await this.db
      .update(paymentExternalRef)
      .set({
        xeroInvoiceId: patch.xeroInvoiceId,
        xeroInvoiceNumber: patch.xeroInvoiceNumber,
        xeroContactId: patch.xeroContactId,
        onlineInvoiceUrl: patch.onlineInvoiceUrl ?? null,
        syncStatus: patch.syncStatus,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(paymentExternalRef.paymentId, paymentId));
  }
}
