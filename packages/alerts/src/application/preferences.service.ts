import type { AlertProduct, AlertTopic } from "../domain/products.js";
import type { SubscriberStatus } from "../domain/subscriber.js";
import { normaliseAlertEmail } from "../domain/subscriber.js";
import { TOPIC_CATALOGUE } from "../domain/topic-catalogue.js";
import type {
  Clock,
  SubscriberStore,
  TopicStore,
  TopicSwitch,
  VerifiedAddressLookup,
} from "../ports.js";
import type { SubscribeService } from "./subscribe.service.js";

export type AccountAlertsView = {
  /** "none": never signed up; "pending": waiting for the confirmation press; otherwise as stored. */
  state: "none" | SubscriberStatus;
  /** Whether the row was a visitor sign-up that this account has not yet taken over. */
  linked: boolean;
  topics: TopicSwitch[];
};

export type PreferencesDeps = {
  subscribers: SubscriberStore;
  topics: TopicStore;
  subscribe: SubscribeService;
  addresses: VerifiedAddressLookup;
  clock: Clock;
};

/** A signed-in person's own switches, read and written through the same rows the links use. */
export class PreferencesService {
  constructor(private readonly deps: PreferencesDeps) {}

  async view(product: AlertProduct, subjectId: string): Promise<AccountAlertsView> {
    const record = await this.recordFor(product, subjectId);
    if (!record) return { state: "none", linked: false, topics: [] };
    return {
      state: record.status,
      linked: record.subjectId === subjectId,
      topics: await this.deps.topics.list(record.id),
    };
  }

  /**
   * The account's row. A confirmed visitor sign-up for the account's own verified address is
   * taken over on first sight, so the person sees the choice they already made.
   */
  private async recordFor(product: AlertProduct, subjectId: string) {
    const own = await this.deps.subscribers.findBySubject(product, subjectId);
    if (own) return own;
    const address = await this.deps.addresses.find(subjectId);
    if (!address?.verified) return null;
    const byEmail = await this.deps.subscribers.findByEmail(
      product,
      normaliseAlertEmail(address.email),
    );
    if (!byEmail || byEmail.status !== "confirmed" || byEmail.subjectId !== null) return byEmail;
    await this.deps.subscribers.linkAccount(byEmail.id, subjectId, this.deps.clock.now());
    return { ...byEmail, subjectId };
  }

  /** Turns one topic's email on or off. Turning it on after a stop starts fresh, by account. */
  async setTopic(input: {
    product: AlertProduct;
    subjectId: string;
    topic: AlertTopic;
    on: boolean;
    /** Whether the topic's email is on. Defaults to `on`; false subscribes for the app alone. */
    email?: boolean;
  }): Promise<"saved" | "unverified" | "no_account" | "blocked"> {
    const record = await this.recordFor(input.product, input.subjectId);
    if (input.on) {
      const outcome = await this.deps.subscribe.enableForAccount({
        product: input.product,
        subjectId: input.subjectId,
        topic: input.topic,
        source: `${input.product}_settings`,
        emailOn: input.email ?? true,
      });
      return outcome === "enabled" ? "saved" : outcome;
    }
    if (record) {
      await this.deps.topics.setEmail(
        record.id,
        input.topic,
        false,
        "person",
        this.deps.clock.now(),
      );
    }
    return "saved";
  }

  /** Whether the topic exists for this product (a guard for route input). */
  static knows(topic: AlertTopic): boolean {
    return topic in TOPIC_CATALOGUE;
  }
}
