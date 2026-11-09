import type { Database } from "@auction/db";
import type {
  IBidPortfolioReader,
  IConnectTransferRepository,
  IPaymentExternalRefRepository,
  IPaymentRefundReconcileRepository,
  IPaymentWebhookLookupReader,
  IPaymentWriteRepository,
  IPayoutRepository,
  IXeroConnectionRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence/interfaces";
import {
  DrizzleBidInvoiceRepository,
  DrizzleBidPortfolioReader,
  DrizzleConnectTransferRepository,
  DrizzlePaymentExternalRefRepository,
  DrizzlePaymentRefundReconcileRepository,
  DrizzlePaymentRefundRepository,
  DrizzlePaymentRepository,
  DrizzlePaymentWebhookLookupReader,
  DrizzlePayoutRepository,
  DrizzleXeroConnectionRepository,
  DrizzleXeroWebhookEventRepository,
} from "@auction/persistence/repositories";

export type PaymentsRepositories = {
  /** Stored Bid invoices: read, raised, and their due dates moved. */
  bidInvoiceRepository: DrizzleBidInvoiceRepository;
  bidPortfolioReader: IBidPortfolioReader;
  payoutRepository: IPayoutRepository;
  connectTransferRepository: IConnectTransferRepository;
  paymentRepo: IPaymentWriteRepository;
  paymentRefundReconcileRepository: IPaymentRefundReconcileRepository;
  /** What buyers were refunded: written with each refund event, read for the invoice document. */
  paymentRefundRepository: DrizzlePaymentRefundRepository;
  paymentExtRepo: IPaymentExternalRefRepository;
  paymentWebhookLookupReader: IPaymentWebhookLookupReader;
  xeroConnRepo: IXeroConnectionRepository;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
};

export function createPaymentsRepositories(db: Database): PaymentsRepositories {
  const bidPortfolioReader: IBidPortfolioReader = new DrizzleBidPortfolioReader(db);
  const payoutRepository: IPayoutRepository = new DrizzlePayoutRepository(db);
  const connectTransferRepository: IConnectTransferRepository =
    new DrizzleConnectTransferRepository(db);
  const paymentRepo = new DrizzlePaymentRepository(db);
  const paymentRefundReconcileRepository = new DrizzlePaymentRefundReconcileRepository(db);
  const paymentExtRepo = new DrizzlePaymentExternalRefRepository(db);
  const paymentWebhookLookupReader = new DrizzlePaymentWebhookLookupReader(db);
  const xeroConnRepo = new DrizzleXeroConnectionRepository(db);
  const xeroWebhookEventRepository = new DrizzleXeroWebhookEventRepository(db);

  return {
    bidInvoiceRepository: new DrizzleBidInvoiceRepository(db),
    bidPortfolioReader,
    payoutRepository,
    connectTransferRepository,
    paymentRepo,
    paymentRefundReconcileRepository,
    paymentRefundRepository: new DrizzlePaymentRefundRepository(db),
    paymentExtRepo,
    paymentWebhookLookupReader,
    xeroConnRepo,
    xeroWebhookEventRepository,
  };
}
