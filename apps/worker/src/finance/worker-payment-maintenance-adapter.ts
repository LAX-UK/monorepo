import type { IStalePaymentMaintenance } from "@auction/finance-cron-app";
import {
  type PaymentMaintenanceCronPorts,
  expireStalePaymentsWithPorts,
} from "@auction/finance-cron-app";
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
      publishCancelled?: PaymentMaintenanceCronPorts["publishPaymentCancelled"];
    },
  ) {
    this.accounting = deps.accounting;
  }

  setAccountingProvider(provider: IInvoiceAccountingProvider) {
    this.accounting = provider;
  }

  async expireStalePendingPayments(pendingMaxAgeDays: number, authorizedMaxAgeDays: number) {
    const ports: PaymentMaintenanceCronPorts = {
      listStalePendingBefore: (cutoff) => this.deps.payments.listStalePendingBefore(cutoff),
      listStaleAuthorizedBefore: (cutoff) => this.deps.payments.listStaleAuthorizedBefore(cutoff),
      cancelPayment: (paymentId) => this.deps.payments.updateStatus(paymentId, "cancelled"),
      publishPaymentCancelled:
        this.deps.publishCancelled ??
        (async () => {
          /* optional domain event */
        }),
    };
    const result = await expireStalePaymentsWithPorts(
      ports,
      pendingMaxAgeDays,
      authorizedMaxAgeDays,
    );
    return result.expired;
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
    );
  }
}
