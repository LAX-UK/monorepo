import type { WorkerEnv } from "../../env.js";
import type { AtgSyncConfig } from "./atg-types.js";
import type { GapHttpAdapterOptions } from "./gap-http-adapter.js";
import { toWindowsTimezoneId } from "./windows-timezone.js";

const MAX_IMAGES_PER_LOT = 20;

export type AtgRuntimeConfig = {
  adapter: GapHttpAdapterOptions;
  sync: AtgSyncConfig;
  pollIntervalMs: number;
};

/** Null when the integration is off. Required values are enforced by the env schema. */
export function loadAtgRuntimeConfig(env: WorkerEnv): AtgRuntimeConfig | null {
  if (!env.ATG_SYNC_ENABLED) return null;
  const required = (value: string | undefined, key: string): string => {
    if (!value) throw new Error(`${key} is required when ATG_SYNC_ENABLED=true`);
    return value;
  };
  toWindowsTimezoneId(env.ATG_TIMEZONE);
  return {
    adapter: {
      baseUrl: env.ATG_API_BASE_URL,
      username: required(env.ATG_API_USERNAME, "ATG_API_USERNAME"),
      password: required(env.ATG_API_PASSWORD, "ATG_API_PASSWORD"),
    },
    sync: {
      platformCode: required(env.ATG_PLATFORM_CODE, "ATG_PLATFORM_CODE"),
      clientId: env.ATG_CLIENT_ID ?? null,
      incrementSetId: required(env.ATG_INCREMENT_SET_ID, "ATG_INCREMENT_SET_ID"),
      defaultCategory: required(env.ATG_DEFAULT_CATEGORY, "ATG_DEFAULT_CATEGORY"),
      auctionType: env.ATG_AUCTION_TYPE,
      listingPrivate: env.ATG_LISTING_PRIVATE,
      artistPlacement: env.ATG_ARTIST_PLACEMENT,
      approveBeforePublish: env.ATG_APPROVE_BEFORE_PUBLISH,
      currency: "GBP",
      countryCode: "UK",
      timezone: env.ATG_TIMEZONE,
      mediaBaseUrl: required(env.S3_PUBLIC_BASE_URL, "S3_PUBLIC_BASE_URL"),
      maxImagesPerLot: MAX_IMAGES_PER_LOT,
    },
    pollIntervalMs: env.ATG_POLL_INTERVAL_MS,
  };
}
