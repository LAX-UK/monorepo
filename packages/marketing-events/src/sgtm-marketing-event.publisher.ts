import type { PublishOutcome, ResolvedMarketingEvent } from "@auction/types";
import { attributionToPublisherParams } from "@auction/validators";
import type { IMarketingEventPublisher } from "./interfaces/marketing-event-publisher.js";

function mapToGa4EventName(name: string): string {
  const snake = name
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
  return snake;
}

export class SgtmMarketingEventPublisher implements IMarketingEventPublisher {
  constructor(
    private readonly endpointUrl: string,
    private readonly measurementId: string,
    private readonly apiSecret: string | undefined = undefined,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async publish(event: ResolvedMarketingEvent): Promise<PublishOutcome> {
    const base = this.endpointUrl.replace(/\/$/, "");
    const secretParam = this.apiSecret ? `&api_secret=${encodeURIComponent(this.apiSecret)}` : "";
    const url = `${base}/g/collect?v=2&tid=${encodeURIComponent(this.measurementId)}${secretParam}`;

    const params: Record<string, string> = {
      en: mapToGa4EventName(event.name),
      _et: "1",
      "ep.event_id": event.eventId,
      "ep.action_source": event.actionSource,
    };

    if (event.name === "Purchase" || event.name === "InitiateCheckout") {
      const cd = event.customData as { valueMinor?: number; currencyCode?: string };
      if (cd.valueMinor != null) params["ep.value"] = (cd.valueMinor / 100).toFixed(2);
      if (cd.currencyCode) params["ep.currency"] = cd.currencyCode;
    }

    if (event.userData.fbp) params["ep.x_fb_ck_fbp"] = event.userData.fbp;
    if (event.userData.fbc) params["ep.x_fb_ck_fbc"] = event.userData.fbc;
    if (event.userData.em?.[0]) params["ep.user_data_email_address"] = event.userData.em[0];
    if (event.userData.external_id?.[0]) {
      params["ep.x_fb_ud_external_id"] = event.userData.external_id[0];
    }
    if (event.eventSourceUrl) {
      params["ep.page_location"] = event.eventSourceUrl;
    }
    if (event.userData.client_ip_address) {
      params["ep.ip_override"] = event.userData.client_ip_address;
    }
    if (event.userData.client_user_agent) {
      params["ep.user_agent"] = event.userData.client_user_agent;
    }
    if (event.clientContext?.gaClientId) {
      params.cid = event.clientContext.gaClientId;
    }
    if (event.clientContext?.gaSessionId) {
      // GA4 web collection protocol field parsed by the sGTM GA4 Client.
      params.sid = event.clientContext.gaSessionId;
    }

    if (event.attribution?.firstTouch) {
      for (const [k, v] of Object.entries(
        attributionToPublisherParams("first", event.attribution.firstTouch, "sgtm"),
      )) {
        params[`ep.${k}`] = v;
      }
    }
    if (event.attribution?.lastTouch) {
      for (const [k, v] of Object.entries(
        attributionToPublisherParams("last", event.attribution.lastTouch, "sgtm"),
      )) {
        params[`ep.${k}`] = v;
      }
    }

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null) body.set(k, String(v));
    }

    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      return {
        status: "failed",
        error: `sgtm_http_${res.status}`,
        retryable: res.status >= 500 || res.status === 429,
      };
    }

    return { status: "sent", vendor: "sgtm" };
  }
}
