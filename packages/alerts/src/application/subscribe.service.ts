import type { AlertProduct, AlertTopic } from "../domain/products.js";
import { normaliseAlertEmail, shouldSendConfirmation } from "../domain/subscriber.js";
import { TOPIC_CATALOGUE } from "../domain/topic-catalogue.js";
import type { AlertLinkCodec } from "../links/codec.js";
import type {
  AlertMailer,
  AlertUrls,
  Clock,
  SubscriberStore,
  SubscriptionConfirmedHook,
  TopicStore,
  VerifiedAddressLookup,
} from "../ports.js";
import { confirmationMessage } from "./confirmation-links.js";

export type SubscribeDeps = {
  subscribers: SubscriberStore;
  topics: TopicStore;
  mailer: AlertMailer;
  codec: AlertLinkCodec;
  urls: AlertUrls;
  addresses: VerifiedAddressLookup;
  clock: Clock;
  /** Runs when an account's email topic is switched on: the same step as a confirm link. */
  afterConfirm?: SubscriptionConfirmedHook;
};

/** `blocked`: the address complained, so only a person at LAX can switch it back on. */
export type AccountEnableOutcome = "enabled" | "unverified" | "no_account" | "blocked";

/** Starting alerts: a visitor by double opt-in, or an account with a verified address at once. */
export class SubscribeService {
  constructor(private readonly deps: SubscribeDeps) {}

  /**
   * A visitor asks for a topic. The answer never says whether the address was already known: the
   * caller gets the same result every time, and only the inbox owner learns anything.
   */
  async requestAsVisitor(input: {
    product: AlertProduct;
    topic: AlertTopic;
    email: string;
    source: string;
  }): Promise<void> {
    const email = normaliseAlertEmail(input.email);
    const now = this.deps.clock.now();
    const existing = await this.deps.subscribers.findByEmail(input.product, email);
    if (!shouldSendConfirmation(existing, now)) return;

    const record = await this.deps.subscribers.savePending({
      product: input.product,
      email,
      consentText: TOPIC_CATALOGUE[input.topic].consentText,
      consentSource: input.source,
      now,
    });
    if (record.status !== "pending") return;

    // The topic is recorded off now and switched on by the confirmation, so the request is whole.
    await this.deps.topics.setEmail(record.id, input.topic, false, "person", now);
    await this.deps.mailer.sendConfirmation(
      confirmationMessage(record, this.deps.codec, this.deps.urls),
    );
  }

  /** An account with a verified address switches a topic on: no confirmation email is needed. */
  async enableForAccount(input: {
    product: AlertProduct;
    subjectId: string;
    topic: AlertTopic;
    source: string;
    emailOn?: boolean;
  }): Promise<AccountEnableOutcome> {
    const address = await this.deps.addresses.find(input.subjectId);
    if (!address) return "no_account";
    if (!address.verified) return "unverified";
    const now = this.deps.clock.now();
    const record = await this.deps.subscribers.saveConfirmedForAccount({
      product: input.product,
      email: normaliseAlertEmail(address.email),
      subjectId: input.subjectId,
      consentText: TOPIC_CATALOGUE[input.topic].consentText,
      consentSource: input.source,
      now,
    });
    if (record.status !== "confirmed") return "blocked";
    const emailOn = input.emailOn ?? true;
    await this.deps.topics.setEmail(record.id, input.topic, emailOn, "person", now);
    // Asking for email is the person's own choice, so it counts as a confirmation of their address.
    if (emailOn) {
      await this.deps.afterConfirm?.({
        subscriberId: record.id,
        product: record.product,
        email: record.email,
        at: now,
      });
    }
    return "enabled";
  }
}
