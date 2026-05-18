import type { Env } from "../env.js";

/** Marketing events (sGTM + Meta CAPI) run only in production with full config. */
export function isMarketingEventsEnabled(env: Env): boolean {
  if (env.NODE_ENV !== "production") return false;
  return Boolean(
    env.SGTM_ENDPOINT_URL?.trim() &&
      env.GA4_MEASUREMENT_ID?.trim() &&
      env.META_PIXEL_ID?.trim() &&
      env.META_CAPI_ACCESS_TOKEN?.trim(),
  );
}
