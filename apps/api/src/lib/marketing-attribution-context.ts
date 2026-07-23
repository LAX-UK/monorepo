import { MARKETING_ATTRIBUTION_HEADER } from "@auction/http-headers";
import type { IAttributionStore } from "@auction/marketing-events";
import type { MarketingAttributionSnapshot, MarketingEvent } from "@auction/types";
import type { MarketingEventConsent } from "@auction/types";
import { mergeServerAttributionPut } from "@auction/validators";
import { parseAttributionHeader } from "./marketing-attribution-header.js";
import { recordMarketingAttributionOperation } from "./marketing-attribution-metrics.js";
import type { WebsiteEventContext } from "./marketing-event-factory.js";
import { buildWebsiteUserEvent } from "./marketing-event-factory.js";

export function consentAllowsAttribution(consent: MarketingEventConsent): boolean {
  return consent.basis === "consent" && consent.marketing === true;
}

export async function resolveAttributionForWebsiteEvent(input: {
  context: WebsiteEventContext;
  consent: MarketingEventConsent;
  userId: string;
  attributionStore: IAttributionStore;
}): Promise<MarketingAttributionSnapshot | undefined> {
  if (!consentAllowsAttribution(input.consent)) return undefined;

  const fromHeader = parseAttributionHeader(input.context.req.header(MARKETING_ATTRIBUTION_HEADER));
  try {
    const stored = await input.attributionStore.get(input.userId);
    if (stored && fromHeader) return mergeServerAttributionPut(stored, fromHeader);
    return stored ?? fromHeader ?? undefined;
  } catch {
    // Attribution is best-effort and must never make the business operation fail.
    return fromHeader ?? undefined;
  }
}

export async function buildEnrichedWebsiteUserEvent(
  c: WebsiteEventContext,
  input: {
    name: MarketingEvent["name"];
    eventId: string;
    userId: string;
    customData: MarketingEvent["customData"];
  },
  opts: {
    attributionEnabled: boolean;
    attributionStore: IAttributionStore;
  },
): Promise<MarketingEvent> {
  const base = buildWebsiteUserEvent(c, input);
  if (!opts.attributionEnabled) {
    recordMarketingAttributionOperation("enrich", "disabled", false);
    return base;
  }
  if (!consentAllowsAttribution(base.consent)) {
    recordMarketingAttributionOperation("enrich", "rejected", true);
    return base;
  }
  const attribution = await resolveAttributionForWebsiteEvent({
    context: c,
    consent: base.consent,
    userId: input.userId,
    attributionStore: opts.attributionStore,
  });
  if (!attribution) {
    recordMarketingAttributionOperation("enrich", "missing", true);
    return base;
  }
  recordMarketingAttributionOperation("enrich", "accepted", true);
  return { ...base, attribution };
}
