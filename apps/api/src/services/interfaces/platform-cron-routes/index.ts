export type {
  LotLifecycleTickCronResult,
  IPlatformLifecycleCronApplicationService,
} from "./platform-lifecycle-cron.js";
export type { IPlatformHygieneCronApplicationService } from "./platform-hygiene-cron.js";

export type PlatformCronRouteServices = {
  lifecycle: import("./platform-lifecycle-cron.js").IPlatformLifecycleCronApplicationService;
  hygiene: import("./platform-hygiene-cron.js").IPlatformHygieneCronApplicationService;
};

export type {
  PlatformHygieneCronRoutesContainer,
  PlatformLifecycleCronRoutesContainer,
} from "./platform-cron-route-container-slices.js";
