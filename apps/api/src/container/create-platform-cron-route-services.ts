import type { IEmailService } from "@auction/email";
import type { LifecycleCronService } from "@auction/finance-cron-app";
import type { IStaffNoticeRecipientReader, IStaffRoster } from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import { StaffRoleExpiryNotifier } from "../infrastructure/staff-role-expiry.notifier.js";
import type { HygieneCronService } from "../services/cron/hygiene-cron.service.js";
import { PlatformHygieneCronApplicationService } from "../services/finance/platform-hygiene-cron-application.service.js";
import type { PlatformCronRouteServices } from "../services/interfaces/platform-cron-routes/index.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import { PlatformLifecycleCronApplicationService } from "../services/platform/platform-lifecycle-cron-application.service.js";
import { StaffRoleExpiryService } from "../services/staff/staff-role-expiry.service.js";

export type CreatePlatformCronRouteServicesInput = {
  redis: Redis;
  lifecycleCronService: LifecycleCronService;
  hygieneCronService: HygieneCronService;
  staffRoster: IStaffRoster;
  staffNoticeRecipients: IStaffNoticeRecipientReader;
  notificationDispatcher: Pick<NotificationDispatcher, "dispatch">;
  emailService: IEmailService;
  webOrigin: string;
};

export function createPlatformCronRouteServices(
  input: CreatePlatformCronRouteServicesInput,
): PlatformCronRouteServices {
  return {
    lifecycle: new PlatformLifecycleCronApplicationService(input.redis, input.lifecycleCronService),
    hygiene: new PlatformHygieneCronApplicationService(input.hygieneCronService),
    staffRoles: new StaffRoleExpiryService(
      input.staffRoster,
      new StaffRoleExpiryNotifier(
        input.staffNoticeRecipients,
        input.notificationDispatcher,
        input.emailService,
        input.webOrigin,
      ),
    ),
  };
}
