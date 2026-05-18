import type { Database } from "@auction/db";
import type { MarketingEvent } from "@auction/types";
import { Counter } from "prom-client";
import type { IMarketingConsentGate } from "./interfaces/marketing-consent-gate.js";
import type { IMarketingEventOutboxRepository } from "./interfaces/marketing-event-outbox.js";
import type { IMarketingEventQueue } from "./interfaces/marketing-event-queue.js";
import type { IMarketingEventService } from "./interfaces/marketing-event-service.js";

const marketingEnqueueErrorTotal = new Counter({
  name: "marketing_events_enqueue_error_total",
  help: "BullMQ enqueue failures for marketing events (outbox poller will recover)",
  labelNames: ["name"] as const,
});

const marketingEmitErrorTotal = new Counter({
  name: "marketing_events_emit_error_total",
  help: "Outbox append failures during emit (business flow continues)",
  labelNames: ["name"] as const,
});

export class MarketingEventService implements IMarketingEventService {
  constructor(
    private readonly outbox: IMarketingEventOutboxRepository,
    private readonly queue: IMarketingEventQueue,
    private readonly consentGate: IMarketingConsentGate,
  ) {}

  async stage(event: MarketingEvent, tx: Database): Promise<void> {
    if (!this.consentGate.isAllowed(event)) {
      await this.outbox.markSkipped(event, "consent_denied", tx);
      return;
    }
    await this.outbox.append(event, tx);
  }

  async emit(event: MarketingEvent): Promise<void> {
    try {
      if (!this.consentGate.isAllowed(event)) {
        await this.outbox.markSkipped(event, "consent_denied");
        return;
      }
      const inserted = await this.outbox.append(event);
      if (!inserted) return;
      await this.enqueue(event);
    } catch (err) {
      marketingEmitErrorTotal.inc({ name: event.name });
      console.error(
        `[marketing] emit failed for ${event.eventId} (${event.name}); business flow continues:`,
        err,
      );
    }
  }

  async enqueue(event: MarketingEvent): Promise<void> {
    try {
      await this.queue.enqueue(event);
    } catch (err) {
      marketingEnqueueErrorTotal.inc({ name: event.name });
      console.error(
        `[marketing] BullMQ enqueue failed for ${event.eventId} (${event.name}); outbox poller will recover:`,
        err,
      );
    }
  }
}
