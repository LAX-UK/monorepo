import type { WorkerEnv } from "../env.js";

export function isMarketingEventsEnabled(env: WorkerEnv): boolean {
  if (env.NODE_ENV !== "production") return false;
  return Boolean(
    env.SGTM_ENDPOINT_URL?.trim() &&
      env.GA4_MEASUREMENT_ID?.trim() &&
      env.META_PIXEL_ID?.trim() &&
      env.META_CAPI_ACCESS_TOKEN?.trim(),
  );
}
