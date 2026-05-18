import type { PublishOutcome, ResolvedMarketingEvent } from "@auction/types";
import type { ICircuitBreaker } from "./interfaces/circuit-breaker.js";
import type { IMarketingEventPublisher } from "./interfaces/marketing-event-publisher.js";

const SGTM_KEY = "sgtm";
const CAPI_KEY = "meta_capi";

/**
 * Primary/fallback publisher (not fan-out). Website events prefer sGTM; system_generated prefer CAPI.
 * Browser pixel + server CAPI dedupe via shared `event_id`.
 */
export class FallbackMarketingEventPublisher implements IMarketingEventPublisher {
  constructor(
    private readonly sgtm: IMarketingEventPublisher,
    private readonly capi: IMarketingEventPublisher,
    private readonly breaker: ICircuitBreaker,
  ) {}

  async publish(event: ResolvedMarketingEvent): Promise<PublishOutcome> {
    const preferCapiDirect = event.actionSource === "system_generated";

    if (preferCapiDirect) {
      return this.publishWithFallback(CAPI_KEY, this.capi, SGTM_KEY, this.sgtm, event);
    }

    return this.publishWithFallback(SGTM_KEY, this.sgtm, CAPI_KEY, this.capi, event);
  }

  private async publishWithFallback(
    primaryKey: string,
    primary: IMarketingEventPublisher,
    fallbackKey: string,
    fallback: IMarketingEventPublisher,
    event: ResolvedMarketingEvent,
  ): Promise<PublishOutcome> {
    if (!this.breaker.isOpen(primaryKey)) {
      try {
        const out = await this.breaker.run(primaryKey, () => primary.publish(event));
        if (out.status === "sent" || out.status === "skipped") return out;
        if (!out.retryable) return out;
      } catch (primaryErr) {
        const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        console.warn(`[marketing-fallback] primary ${primaryKey} failed: ${msg}`);
      }
    }

    if (this.breaker.isOpen(fallbackKey)) {
      return { status: "failed", error: "all_circuits_open", retryable: true };
    }

    try {
      return await this.breaker.run(fallbackKey, () => fallback.publish(event));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: "failed", error: msg, retryable: true };
    }
  }
}
