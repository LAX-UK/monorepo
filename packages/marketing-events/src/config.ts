export type MarketingEventsEnv = {
  NODE_ENV: string;
  SGTM_ENDPOINT_URL?: string | undefined;
  GA4_MEASUREMENT_ID?: string | undefined;
  META_PIXEL_ID?: string | undefined;
  META_CAPI_ACCESS_TOKEN?: string | undefined;
  META_CAPI_TEST_EVENT_CODE?: string | undefined;
  META_GRAPH_API_VERSION?: string | undefined;
};

export type MarketingEventsConfig = {
  sgtmEndpointUrl: string;
  ga4MeasurementId: string;
  metaPixelId: string;
  metaCapiAccessToken: string;
  metaCapiTestEventCode: string | undefined;
  metaGraphApiVersion: string;
};

/** Resolved marketing publisher config when sGTM + Meta CAPI are fully configured. */
export function getMarketingEventsConfig(
  env: MarketingEventsEnv,
): MarketingEventsConfig | undefined {
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
export function isMarketingEventsEnabled(env: MarketingEventsEnv): boolean {
  return getMarketingEventsConfig(env) !== undefined;
}
