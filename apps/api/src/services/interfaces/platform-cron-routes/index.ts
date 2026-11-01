import type { IWatchedLotReminderJob } from "../../watchlist-reminders/watched-lot-reminder.job.js";

export type {
  LotLifecycleTickCronResult,
  IPlatformLifecycleCronApplicationService,
} from "./platform-lifecycle-cron.js";
export type { IPlatformHygieneCronApplicationService } from "./platform-hygiene-cron.js";
export type { IPlatformStaffRolesCronApplicationService } from "./platform-staff-roles-cron.js";

export type PlatformCronRouteServices = {
  lifecycle: import("./platform-lifecycle-cron.js").IPlatformLifecycleCronApplicationService;
  hygiene: import("./platform-hygiene-cron.js").IPlatformHygieneCronApplicationService;
  staffRoles: import("./platform-staff-roles-cron.js").IPlatformStaffRolesCronApplicationService;
  watchedLotReminders: IWatchedLotReminderJob;
};

export type {
  PlatformHygieneCronRoutesContainer,
  PlatformLifecycleCronRoutesContainer,
  PlatformStaffRolesCronRoutesContainer,
} from "./platform-cron-route-container-slices.js";
