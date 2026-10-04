import {
  type SharedSentryInitDefaults,
  createSharedSentryInitOptions,
} from "./sentry-init-options.js";

/** Shared Sentry init (PII off + scrubber) for Shop deployables. */
export function createShopAppsSentryInitOptions(
  dsn: string,
  defaults: SharedSentryInitDefaults = {},
) {
  return createSharedSentryInitOptions(dsn, defaults);
}
