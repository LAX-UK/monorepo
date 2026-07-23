import { AccountingReplayCronService } from "@auction/finance-cron-app";
import type { IAccountingReplayPaymentMaintenance } from "@auction/finance-cron-app";
import type {
  IAddressRepository,
  ILegalEntityRepository,
  IPaymentExternalRefRepository,
  IPaymentRefundReconcileRepository,
  IPaymentWriteRepository,
  IPayoutRepository,
  IProfileReader,
  IXeroConnectionRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import { NoOpAccountingProvider } from "./accounting/no-op-accounting.provider.js";
import { XeroAccountingProvider } from "./accounting/xero-accounting.provider.js";
import { proactiveRefreshXeroTokens } from "./accounting/xero-auth-runtime.js";
import { XeroPaymentRecorder } from "./accounting/xero-payment-recorder.js";
import { XeroPayoutBillWriter } from "./accounting/xero-payout-bill.writer.js";
import type { FinanceRuntimeEnv } from "./env-slice.js";
import { xeroOAuthConfigured } from "./env-slice.js";
import type { IErrorReporter } from "./interfaces/error-handling.js";
import { InvoiceAddressingService } from "./invoice-addressing.js";
import { NoOpErrorReporter } from "./no-op-error-reporter.js";

export type CreateXeroAccountingStackInput = {
  env: FinanceRuntimeEnv;
  redis: Redis;
  log: Logger;
  connections: IXeroConnectionRepository;
  externalRefs: IPaymentExternalRefRepository;
  payments: IPaymentWriteRepository;
  payouts: IPayoutRepository;
  refundReconcileRepo: IPaymentRefundReconcileRepository;
  webhookEvents: IXeroWebhookEventRepository;
  legalEntities: ILegalEntityRepository | null;
  profileReader: IProfileReader | null;
  addressRepo: IAddressRepository | null;
  paymentMaintenance: IAccountingReplayPaymentMaintenance;
  errorReporter?: IErrorReporter;
};

export type XeroAccountingStack = {
  accountingReplayCronService: AccountingReplayCronService;
  xeroPaymentRecorder: XeroPaymentRecorder | null;
  xeroPayoutBillWriter: XeroPayoutBillWriter | null;
  accountingProvider: XeroAccountingProvider | NoOpAccountingProvider;
};

export function createXeroAccountingStack(
  input: CreateXeroAccountingStackInput,
): XeroAccountingStack {
  const errorReporter = input.errorReporter ?? new NoOpErrorReporter();
  const xeroEnabled = xeroOAuthConfigured(input.env);

  const invoiceAddressing =
    input.legalEntities && input.profileReader && input.addressRepo
      ? new InvoiceAddressingService(
          input.payments,
          input.legalEntities,
          input.profileReader,
          input.addressRepo,
          input.log,
        )
      : null;

  const accountingProvider = xeroEnabled
    ? new XeroAccountingProvider(
        input.env,
        input.connections,
        input.externalRefs,
        input.legalEntities,
        invoiceAddressing,
        errorReporter,
        input.redis,
      )
    : new NoOpAccountingProvider();

  const xeroPayoutBillWriter =
    xeroEnabled && input.legalEntities
      ? new XeroPayoutBillWriter(
          input.env,
          input.connections,
          input.payouts,
          input.legalEntities,
          errorReporter,
          input.redis,
        )
      : null;

  const xeroPaymentRecorder = xeroEnabled
    ? new XeroPaymentRecorder(
        input.env,
        input.connections,
        input.externalRefs,
        errorReporter,
        input.redis,
      )
    : null;

  const accountingReplayCronService = new AccountingReplayCronService(
    input.refundReconcileRepo,
    input.webhookEvents,
    accountingProvider,
    xeroPaymentRecorder,
    input.paymentMaintenance,
    input.payments,
    input.payouts,
    {
      isConfigured: () => xeroEnabled,
      refresh: async () => {
        const result = await proactiveRefreshXeroTokens({
          env: input.env,
          connections: input.connections,
          redis: input.redis,
        });
        if (!result.ok) {
          const reason = "reason" in result ? result.reason : "refresh_failed";
          return {
            ok: false as const,
            error: reason,
            status: reason === "not_connected" ? 200 : 502,
            result,
          };
        }
        return { ok: true as const, result };
      },
    },
  );

  return {
    accountingReplayCronService,
    xeroPaymentRecorder,
    xeroPayoutBillWriter,
    accountingProvider,
  };
}
