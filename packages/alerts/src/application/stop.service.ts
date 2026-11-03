import type { AlertProduct, AlertTopic } from "../domain/products.js";
import { type StopReason, maskEmail } from "../domain/subscriber.js";
import type { AlertLinkCodec } from "../links/codec.js";
import type { Clock, SubscriberStore, TopicStore } from "../ports.js";

export type StopPreview =
  | {
      state: "ready";
      maskedEmail: string;
      /** The topics that are on now; the page offers "only this topic" when there are several. */
      topics: AlertTopic[];
      /** The topic of the email the person came from, when the link named one. */
      fromTopic: AlertTopic | null;
    }
  | { state: "already_stopped"; maskedEmail: string }
  | { state: "invalid" };

export type StopScope = { scope: "all" } | { scope: "topic"; topic: AlertTopic };
export type StopOutcome = "stopped" | "already_stopped" | "invalid";

export type StopDeps = {
  subscribers: SubscriberStore;
  topics: TopicStore;
  codec: AlertLinkCodec;
  clock: Clock;
};

/**
 * Stopping alerts. A stop never writes the global email suppression: it switches off this
 * product's topics for the address, so stopping one product's alerts never silences another.
 */
export class StopService {
  constructor(private readonly deps: StopDeps) {}

  async preview(token: string, product: AlertProduct): Promise<StopPreview> {
    const resolved = await this.resolve(token, product);
    if (!resolved) return { state: "invalid" };
    const maskedEmail = maskEmail(resolved.record.email);
    if (resolved.record.status === "stopped") return { state: "already_stopped", maskedEmail };
    const switches = await this.deps.topics.list(resolved.record.id);
    return {
      state: "ready",
      maskedEmail,
      topics: switches.filter((s) => s.emailOn).map((s) => s.topic),
      fromTopic: resolved.topic,
    };
  }

  /** The stop page's button: every topic, or only the one the person came from. */
  async stop(
    token: string,
    product: AlertProduct,
    choice: StopScope,
    reason: StopReason = "link",
  ): Promise<StopOutcome> {
    const resolved = await this.resolve(token, product);
    if (!resolved) return "invalid";
    const { record } = resolved;
    const now = this.deps.clock.now();
    if (record.status === "stopped") return "already_stopped";
    if (choice.scope === "topic") {
      await this.deps.topics.setEmail(record.id, choice.topic, false, "person", now);
      const remaining = (await this.deps.topics.list(record.id)).some((s) => s.emailOn);
      if (remaining) return "stopped";
    }
    await this.deps.subscribers.stop(record.id, reason, now);
    return "stopped";
  }

  /** A mail app's one-click unsubscribe: every topic of the product, no page, no sign-in. */
  async stopOneClick(token: string, product: AlertProduct): Promise<StopOutcome> {
    return this.stop(token, product, { scope: "all" }, "one_click");
  }

  private async resolve(token: string, product: AlertProduct) {
    const verified = this.deps.codec.verify(token, this.deps.clock.now());
    const payload = verified?.payload;
    if (!payload || payload.kind !== "stop" || payload.product !== product) return null;
    const record = await this.deps.subscribers.findById(payload.subscriberId);
    if (!record || record.linkVersion !== payload.linkVersion) return null;
    return { record, topic: payload.topic ?? null };
  }
}
