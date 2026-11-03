import type { AlertProduct, AlertTopic } from "../domain/products.js";
import { maskEmail } from "../domain/subscriber.js";
import { evaluateConfirmation } from "../domain/subscriber.js";
import type { AlertLinkCodec, LinkPayload } from "../links/codec.js";
import type { Clock, SubscriberStore, TopicStore } from "../ports.js";

/** What opening a confirm link would do, shown on the page before the button is pressed. */
export type ConfirmPreview =
  | { state: "ready"; maskedEmail: string }
  | { state: "already_confirmed"; maskedEmail: string }
  | { state: "expired" }
  | { state: "invalid" };

export type ConfirmOutcome = "confirmed" | "already_confirmed" | "expired" | "invalid";

export type ConfirmDeps = {
  subscribers: SubscriberStore;
  topics: TopicStore;
  codec: AlertLinkCodec;
  clock: Clock;
  /** The topics a confirmation switches on, per product. */
  topicsToEnable: (product: AlertProduct) => readonly AlertTopic[];
};

/** Reads and applies confirm links. Reading never changes anything; only `confirm` does. */
export class ConfirmService {
  constructor(private readonly deps: ConfirmDeps) {}

  async preview(token: string, product: AlertProduct): Promise<ConfirmPreview> {
    const resolved = await this.resolve(token, product);
    if (!resolved) return { state: "invalid" };
    const { record, outcome } = resolved;
    if (outcome === "expired") return { state: "expired" };
    if (outcome === "invalid") return { state: "invalid" };
    const maskedEmail = maskEmail(record.email);
    return outcome === "already_confirmed"
      ? { state: "already_confirmed", maskedEmail }
      : { state: "ready", maskedEmail };
  }

  async confirm(token: string, product: AlertProduct): Promise<ConfirmOutcome> {
    const resolved = await this.resolve(token, product);
    if (!resolved) return "invalid";
    const { record, outcome } = resolved;
    const now = this.deps.clock.now();
    if (outcome === "confirmed") await this.deps.subscribers.confirm(record.id, now);
    if (outcome === "confirmed" || outcome === "already_confirmed") {
      // Idempotent: a retry after a partial failure finishes switching the topics on.
      for (const topic of this.deps.topicsToEnable(record.product)) {
        await this.deps.topics.setEmail(record.id, topic, true, "person", now);
      }
    }
    return outcome;
  }

  private async resolve(token: string, product: AlertProduct) {
    const now = this.deps.clock.now();
    const verified = this.deps.codec.verify(token, now);
    const payload: LinkPayload | undefined = verified?.payload;
    if (!payload || payload.kind !== "confirm" || payload.product !== product) return null;
    if (payload.requestedAtMs === undefined) return null;
    const record = await this.deps.subscribers.findById(payload.subscriberId);
    if (!record || record.linkVersion !== payload.linkVersion) return null;
    return { record, outcome: evaluateConfirmation(record, payload.requestedAtMs, now) };
  }
}
