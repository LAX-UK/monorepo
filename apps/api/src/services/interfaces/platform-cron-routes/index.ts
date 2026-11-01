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
  consignmentThreads: IPlatformConsignmentThreadsCronApplicationService;
};

export type {
  PlatformHygieneCronRoutesContainer,
  PlatformLifecycleCronRoutesContainer,
  PlatformStaffRolesCronRoutesContainer,
  PlatformConsignmentThreadsCronRoutesContainer,
} from "./platform-cron-route-container-slices.js";
