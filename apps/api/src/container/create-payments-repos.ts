import type { Database } from "@auction/db";
import type {
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
  DrizzleConnectTransferRepository,
  DrizzlePaymentExternalRefRepository,
  DrizzlePaymentRefundReconcileRepository,
  DrizzlePaymentRepository,
  DrizzlePaymentWebhookLookupReader,
  DrizzlePayoutRepository,
  DrizzleXeroConnectionRepository,
  DrizzleXeroWebhookEventRepository,
} from "@auction/persistence/repositories";

export type PaymentsRepositories = {
  payoutRepository: IPayoutRepository;
  connectTransferRepository: IConnectTransferRepository;
  paymentRepo: IPaymentWriteRepository;
  paymentRefundReconcileRepository: IPaymentRefundReconcileRepository;
  paymentExtRepo: IPaymentExternalRefRepository;
  paymentWebhookLookupReader: IPaymentWebhookLookupReader;
  xeroConnRepo: IXeroConnectionRepository;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
};

export function createPaymentsRepositories(db: Database): PaymentsRepositories {
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
    payoutRepository,
    connectTransferRepository,
    paymentRepo,
    paymentRefundReconcileRepository,
    paymentExtRepo,
    paymentWebhookLookupReader,
    xeroConnRepo,
    xeroWebhookEventRepository,
  };
}
