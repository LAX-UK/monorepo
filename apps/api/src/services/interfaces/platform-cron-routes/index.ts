import type { PaymentReminderService } from "../../buyer-default/payment-reminder.service.js";
import type { DealSettlementFollowUpService } from "../../private-sale-deal/deal-settlement-follow-up.service.js";
import type { StripeRefundReconcileService } from "../../stripe-webhook/stripe-refund-reconcile.service.js";
import type { IWatchedLotReminderJob } from "../../watchlist-reminders/watched-lot-reminder.job.js";
import type { IPlatformConsignmentThreadsCronApplicationService } from "./platform-consignment-threads-cron.js";

export type {
  LotLifecycleTickCronResult,
  IPlatformLifecycleCronApplicationService,
} from "./platform-lifecycle-cron.js";
export type { IPlatformHygieneCronApplicationService } from "./platform-hygiene-cron.js";
export type { IPlatformStaffRolesCronApplicationService } from "./platform-staff-roles-cron.js";
export type {
  ConsignmentThreadSweepCronResult,
  IPlatformConsignmentThreadsCronApplicationService,
} from "./platform-consignment-threads-cron.js";

export type PlatformCronRouteServices = {
  lifecycle: import("./platform-lifecycle-cron.js").IPlatformLifecycleCronApplicationService;
  hygiene: import("./platform-hygiene-cron.js").IPlatformHygieneCronApplicationService;
  staffRoles: import("./platform-staff-roles-cron.js").IPlatformStaffRolesCronApplicationService;
  watchedLotReminders: IWatchedLotReminderJob;
  paymentReminders: Pick<PaymentReminderService, "sendDueReminders">;
  dealSettlementFollowUps: Pick<DealSettlementFollowUpService, "raiseNew">;
  consignmentThreads: IPlatformConsignmentThreadsCronApplicationService;
  /** Settles refunds Stripe had not finished; null where Stripe payments are not set up. */
  stripeRefundReconcile: Pick<StripeRefundReconcileService, "run"> | null;
};

export type {
  PlatformHygieneCronRoutesContainer,
  PlatformLifecycleCronRoutesContainer,
  PlatformStaffRolesCronRoutesContainer,
  PlatformConsignmentThreadsCronRoutesContainer,
} from "./platform-cron-route-container-slices.js";
