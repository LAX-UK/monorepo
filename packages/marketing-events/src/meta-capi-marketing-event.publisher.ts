import type { PublishOutcome, ResolvedMarketingEvent } from "@auction/types";
import type { IMarketingEventPublisher } from "./interfaces/marketing-event-publisher.js";
import { metaEventNameFor } from "./meta-event-name-map.js";

const META_STANDARD_EVENTS = new Set([
  "Purchase",
  "InitiateCheckout",
  "CompleteRegistration",
  "Lead",
  "AddToWishlist",
]);

export class MetaCapiMarketingEventPublisher implements IMarketingEventPublisher {
  constructor(
    private readonly pixelId: string,
    private readonly accessToken: string,
    private readonly testEventCode: string | undefined,
    private readonly apiVersion = "v21.0",
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async publish(event: ResolvedMarketingEvent): Promise<PublishOutcome> {
    const outcomes = await this.publishBatch([event]);
    return outcomes[0] ?? { status: "failed", error: "empty_batch", retryable: true };
  }

  async publishBatch(events: ResolvedMarketingEvent[]): Promise<PublishOutcome[]> {
    if (events.length === 0) return [];

    const data = events.map((event) => this.toMetaPayload(event));

    const payload = {
      data,
      ...(this.testEventCode ? { test_event_code: this.testEventCode } : {}),
    };

    const url = `https://graph.facebook.com/${this.apiVersion}/${encodeURIComponent(this.pixelId)}/events?access_token=${encodeURIComponent(this.accessToken)}`;

    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const retryable = res.status >= 500 || res.status === 429;
      const outcome: PublishOutcome = {
        status: "failed",
        error: `meta_capi_http_${res.status}:${text.slice(0, 200)}`,
        retryable,
      };
      return events.map(() => outcome);
    }

    const bodyText = await res.text().catch(() => "");
    let partialErrors = false;
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as {
          events_received?: number;
          messages?: string[];
          error?: { message?: string };
        };
        if (parsed.error?.message) {
          partialErrors = true;
          const outcome: PublishOutcome = {
            status: "failed",
            error: `meta_capi_body:${parsed.error.message.slice(0, 200)}`,
            retryable: false,
          };
          return events.map(() => outcome);
        }
        if (
          typeof parsed.events_received === "number" &&
          parsed.events_received < events.length
        ) {
          partialErrors = true;
        }
      } catch {
        /* non-JSON success body is acceptable */
      }
    }
    if (partialErrors) {
      const outcome: PublishOutcome = {
        status: "failed",
        error: "meta_capi_partial_batch_rejection",
        retryable: true,
      };
      return events.map(() => outcome);
    }

    return events.map(() => ({ status: "sent", vendor: "meta_capi" as const }));
  }

  private toMetaPayload(event: ResolvedMarketingEvent): Record<string, unknown> {
    const eventName = META_STANDARD_EVENTS.has(event.name)
      ? event.name
      : metaEventNameFor(event.name);

    const customData: Record<string, unknown> = {};
    if (event.name === "Purchase" || event.name === "InitiateCheckout") {
      const cd = event.customData as {
        valueMinor?: number;
        currencyCode?: string;
        lotId?: string;
      };
      if (cd.valueMinor != null) customData.value = cd.valueMinor / 100;
      if (cd.currencyCode) customData.currency = cd.currencyCode;
      if (cd.lotId) customData.content_ids = [cd.lotId];
    } else if ("lotId" in event.customData) {
      customData.content_ids = [(event.customData as { lotId: string }).lotId];
    }

    const userData: Record<string, unknown> = {};
    if (event.userData.em?.[0]) userData.em = event.userData.em;
    if (event.userData.ph?.[0]) userData.ph = event.userData.ph;
    if (event.userData.fn?.[0]) userData.fn = event.userData.fn;
    if (event.userData.ln?.[0]) userData.ln = event.userData.ln;
    if (event.userData.external_id?.[0]) userData.external_id = event.userData.external_id;
    if (event.userData.fbp) userData.fbp = event.userData.fbp;
    if (event.userData.fbc) userData.fbc = event.userData.fbc;
    if (event.userData.client_ip_address)
      userData.client_ip_address = event.userData.client_ip_address;
    if (event.userData.client_user_agent)
      userData.client_user_agent = event.userData.client_user_agent;

    return {
      event_name: eventName,
      event_time: event.eventTime,
      event_id: event.eventId,
      action_source: event.actionSource,
      ...(event.eventSourceUrl && event.actionSource === "website"
        ? { event_source_url: event.eventSourceUrl }
        : {}),
      user_data: userData,
      custom_data: Object.keys(customData).length > 0 ? customData : undefined,
    };
  }
}
