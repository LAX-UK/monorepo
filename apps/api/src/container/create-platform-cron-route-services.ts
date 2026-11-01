import type { IEmailService } from "@auction/email";
import type { LifecycleCronService } from "@auction/finance-cron-app";
import type {
  ILaxAdminRoleExpiryRequests,
  IStaffNoticeRecipientReader,
  IStaffRoster,
  IWatchlistReminderRepository,
} from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import { StaffRoleExpiryNotifier } from "../infrastructure/staff-role-expiry.notifier.js";
import type { ConsignmentThreadSweepService } from "../services/consignment-messages/consignment-thread-sweep.service.js";
import type { HygieneCronService } from "../services/cron/hygiene-cron.service.js";
import { PlatformHygieneCronApplicationService } from "../services/finance/platform-hygiene-cron-application.service.js";
import type { PlatformCronRouteServices } from "../services/interfaces/platform-cron-routes/index.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import { PlatformLifecycleCronApplicationService } from "../services/platform/platform-lifecycle-cron-application.service.js";
import {
  LaxAdminRoleExpiryService,
  StaffRoleExpiryJob,
} from "../services/staff/lax-admin-role-expiry.service.js";
import { StaffRoleExpiryService } from "../services/staff/staff-role-expiry.service.js";
import type { IStaffAdministrators } from "../services/staff/staff-role-notices.js";
import { WatchedLotReminderJob } from "../services/watchlist-reminders/watched-lot-reminder.job.js";

export type CreatePlatformCronRouteServicesInput = {
  redis: Redis;
  lifecycleCronService: LifecycleCronService;
  hygieneCronService: HygieneCronService;
  staffRoster: IStaffRoster;
  laxAdminRoleExpiry: ILaxAdminRoleExpiryRequests;
  staffNoticeRecipients: IStaffNoticeRecipientReader;
  staffAdministrators: IStaffAdministrators;
  notificationDispatcher: Pick<NotificationDispatcher, "dispatch">;
  emailService: IEmailService;
  webOrigin: string;
  watchlistReminders: Pick<IWatchlistReminderRepository, "listPending" | "markSent">;
  consignmentThreadSweep: ConsignmentThreadSweepService;
};

export function createPlatformCronRouteServices(
  input: CreatePlatformCronRouteServicesInput,
): PlatformCronRouteServices {
  const expiryNotifier = new StaffRoleExpiryNotifier(
    input.staffNoticeRecipients,
    input.staffAdministrators,
    input.notificationDispatcher,
    input.emailService,
    input.webOrigin,
  );
  return {
    lifecycle: new PlatformLifecycleCronApplicationService(input.redis, input.lifecycleCronService),
    hygiene: new PlatformHygieneCronApplicationService(input.hygieneCronService),
    consignmentThreads: {
      sweepConsignmentThreads: () => input.consignmentThreadSweep.sweep(),
    },
    // One daily job ends expired roles on both admins, with the same notices.
    staffRoles: new StaffRoleExpiryJob([
      new StaffRoleExpiryService(input.staffRoster, expiryNotifier),
      new LaxAdminRoleExpiryService(input.laxAdminRoleExpiry, expiryNotifier),
    ]),
    watchedLotReminders: new WatchedLotReminderJob({
      reminders: input.watchlistReminders,
      dispatcher: input.notificationDispatcher,
    }),
  };
}
