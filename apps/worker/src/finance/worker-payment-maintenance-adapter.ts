import type { IStalePaymentMaintenance } from "@auction/finance-cron-app";
import type { IInvoiceAccountingProvider } from "@auction/finance-runtime";
import { ensureXeroInvoiceForPayment } from "@auction/finance-runtime";
import type {
  ILotRepository,
  IPaymentWriteRepository,
  IUserRepository,
} from "@auction/persistence/interfaces";

export class WorkerPaymentMaintenanceAdapter implements IStalePaymentMaintenance {
  private accounting: IInvoiceAccountingProvider | null = null;

  constructor(
    private readonly deps: {
      payments: IPaymentWriteRepository;
      accounting: IInvoiceAccountingProvider | null;
      lots: ILotRepository;
      users: IUserRepository;
      /** The shared expiry job (see `createWorkerStalePaymentExpiry`). */
      expireStale: (pendingMaxAgeDays: number, authorizedMaxAgeDays: number) => Promise<number>;
    },
  ) {
    this.accounting = deps.accounting;
  }

  setAccountingProvider(provider: IInvoiceAccountingProvider) {
    this.accounting = provider;
  }

  expireStalePendingPayments(pendingMaxAgeDays: number, authorizedMaxAgeDays: number) {
    return this.deps.expireStale(pendingMaxAgeDays, authorizedMaxAgeDays);
  }

  async backfillXeroInvoiceForPayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.accounting?.isConfigured()) {
      return { ok: false, error: "xero_not_configured" };
    }
    const payment = await this.deps.payments.findById(paymentId);
    if (!payment) return { ok: false, error: "payment_not_found" };
    const lot = await this.deps.lots.findById(payment.lotId);
    if (!lot) return { ok: false, error: "lot_not_found" };
    return ensureXeroInvoiceForPayment(
      this.accounting,
      this.deps.users,
      paymentId,
      lot,
      payment.buyerId ?? payment.paidByUserId ?? "",
      payment.amount,
      payment.createdAt,
    );
  }
}
