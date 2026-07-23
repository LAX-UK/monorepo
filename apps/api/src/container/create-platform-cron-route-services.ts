import type { LifecycleCronService } from "@auction/finance-cron-app";
import type { Redis } from "ioredis";
import type { HygieneCronService } from "../services/cron/hygiene-cron.service.js";
import { PlatformHygieneCronApplicationService } from "../services/finance/platform-hygiene-cron-application.service.js";
import type { PlatformCronRouteServices } from "../services/interfaces/platform-cron-routes/index.js";
import { PlatformLifecycleCronApplicationService } from "../services/platform/platform-lifecycle-cron-application.service.js";

export type CreatePlatformCronRouteServicesInput = {
  redis: Redis;
  lifecycleCronService: LifecycleCronService;
  hygieneCronService: HygieneCronService;
};

export function createPlatformCronRouteServices(
  input: CreatePlatformCronRouteServicesInput,
): PlatformCronRouteServices {
  return {
    lifecycle: new PlatformLifecycleCronApplicationService(input.redis, input.lifecycleCronService),
    hygiene: new PlatformHygieneCronApplicationService(input.hygieneCronService),
  };
}
