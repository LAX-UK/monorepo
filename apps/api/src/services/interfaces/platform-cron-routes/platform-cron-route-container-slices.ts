import type { PlatformCronRouteServices } from "./index.js";

type PlatformCronRoutePick<K extends keyof PlatformCronRouteServices> = {
  platformCron: Pick<PlatformCronRouteServices, K>;
};

export type PlatformLifecycleCronRoutesContainer = PlatformCronRoutePick<"lifecycle">;
export type PlatformHygieneCronRoutesContainer = PlatformCronRoutePick<"hygiene">;
