import type { Env } from "../env.js";

export type MarketingEventsConfig = {
  sgtmEndpointUrl: string;
  ga4MeasurementId: string;
  metaPixelId: string;
  metaCapiAccessToken: string;
  metaCapiTestEventCode: string | undefined;
  metaGraphApiVersion: string;
};

/** Resolved marketing publisher config when sGTM + Meta CAPI are fully configured. */
export function getMarketingEventsConfig(env: Env): MarketingEventsConfig | undefined {
  if (env.NODE_ENV !== "production") return undefined;

  const sgtmEndpointUrl = env.SGTM_ENDPOINT_URL?.trim();
  const ga4MeasurementId = env.GA4_MEASUREMENT_ID?.trim();
  const metaPixelId = env.META_PIXEL_ID?.trim();
  const metaCapiAccessToken = env.META_CAPI_ACCESS_TOKEN?.trim();

  if (!sgtmEndpointUrl || !ga4MeasurementId || !metaPixelId || !metaCapiAccessToken) {
    return undefined;
  }

  return {
    sgtmEndpointUrl,
    ga4MeasurementId,
    metaPixelId,
    metaCapiAccessToken,
    metaCapiTestEventCode: env.META_CAPI_TEST_EVENT_CODE,
    metaGraphApiVersion: env.META_GRAPH_API_VERSION ?? "v21.0",
  };
}

/** Marketing events (sGTM + Meta CAPI) run only in production with full config. */
export function isMarketingEventsEnabled(env: Env): boolean {
  return getMarketingEventsConfig(env) !== undefined;
}
