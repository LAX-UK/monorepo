import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import { createBaseLogger } from "../lib/logger.js";
import type {
  IPayoutAdminService,
  IPayoutMaintenanceService,
  IPayoutSellerService,
  IPayoutService,
  IPayoutSettlementService,
} from "../services/interfaces/payout.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import { InvoiceAddressingService } from "../services/invoice-addressing.js";
import { PaymentRefundReconcileService } from "../services/payment/payment-refund-reconcile.service.js";
import { PayoutService } from "../services/payout.service.js";
import { PayoutAdjustmentService } from "../services/payout/payout-adjustment.service.js";
import { StripeConnectFacade } from "../services/stripe/stripe-connect.facade.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformCore } from "./create-platform-core.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerPlatformPayoutServices = {
  payoutAdjustmentService: PayoutAdjustmentService;
  payoutService: IPayoutService;
  payoutSellerService: IPayoutSellerService;
  payoutAdminService: IPayoutAdminService;
  payoutSettlementService: IPayoutSettlementService;
  payoutMaintenanceService: IPayoutMaintenanceService;
  stripeConnectService: IStripeConnectService;
  paymentRefundReconcileService: PaymentRefundReconcileService;
  invoiceAddressingService: InvoiceAddressingService;
};

export type CreatePlatformPayoutServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  core: ContainerPlatformCore;
};

export function createPlatformPayoutServices(
  input: CreatePlatformPayoutServicesInput,
): ContainerPlatformPayoutServices {
  const { env, db, infra, repos, core } = input;
  const { stripeClientFactory, redis } = infra;
  const {
    payoutRepository,
    paymentRepo,
    paymentRefundReconcileRepository,
    legalEntityRepository,
    profileRepo,
    addressRepo,
    connectTransferRepository,
  } = repos;
  const { domainEventPublisher } = core;

  const payoutAdjustmentService = new PayoutAdjustmentService(db, payoutRepository);
  const payoutServiceInstance = new PayoutService(
    payoutRepository,
    db,
    domainEventPublisher,
    payoutAdjustmentService,
  );
  const payoutService: IPayoutService = payoutServiceInstance;
  const payoutSellerService: IPayoutSellerService = payoutServiceInstance;
  const payoutAdminService: IPayoutAdminService = payoutServiceInstance;
  const payoutSettlementService: IPayoutSettlementService = payoutServiceInstance;
  const payoutMaintenanceService: IPayoutMaintenanceService = payoutServiceInstance;
  const stripeConnectService: IStripeConnectService = new StripeConnectFacade(
    env,
    db,
    payoutService,
    connectTransferRepository,
    repos.legalEntityConnectRepository,
    payoutRepository,
    domainEventPublisher,
    stripeClientFactory,
    redis,
  );
  const paymentRefundReconcileService = new PaymentRefundReconcileService(
    db,
    paymentRepo,
    payoutAdjustmentService,
    domainEventPublisher,
    paymentRefundReconcileRepository,
  );
  const invoiceAddressingService = new InvoiceAddressingService(
    paymentRepo,
    legalEntityRepository,
    profileRepo,
    addressRepo,
    createBaseLogger(env).child({ component: "invoice_addressing" }),
  );

  return {
    payoutAdjustmentService,
    payoutService,
    payoutSellerService,
    payoutAdminService,
    payoutSettlementService,
    payoutMaintenanceService,
    stripeConnectService,
    paymentRefundReconcileService,
    invoiceAddressingService,
  };
}
