import {
  type AlertLinkCodec,
  type AlertUrls,
  type Clock,
  type SubscriberStore,
  type TopicStore,
  normaliseAlertEmail,
} from "@auction/alerts";

export const BACK_IN_STOCK_TOPIC = "shop.back_in_stock" as const;
const SOURCE = "shop_back_in_stock";
/** What the person agreed to: the same wording the topic stores as consent. */
const CONSENT_TEXT =
  "You pressed Notify me on an edition. We'll email you once when it is available.";

export type BackInStockLink = {
  subscriberId: string;
  /** The person stopped LAX Shop alerts, or this topic, since they asked: nothing more is sent. */
  stopped: boolean;
  /** The signed stop token for this topic: the shared alert engine's link. */
  token: string;
  stopUrl: string;
  oneClickUrl: string;
  /** Where an account holder manages their alerts; null for a guest. */
  manageUrl: string | null;
};

export type BackInStockLinks = {
  /**
   * The engine link for a back-in-stock email, creating the person's engine row when they have
   * none. An account with a verified address is recorded as confirmed; a guest's unverified
   * address is only recorded as pending, which is enough for a stop link and never receives
   * release alerts.
   */
  linkFor(input: { email: string; subjectId: string | null }): Promise<BackInStockLink>;
};

export function createBackInStockLinks(deps: {
  subscribers: SubscriberStore;
  topics: TopicStore;
  codec: AlertLinkCodec;
  urls: AlertUrls;
  clock: Clock;
}): BackInStockLinks {
  return {
    async linkFor({ email: rawEmail, subjectId }) {
      const email = normaliseAlertEmail(rawEmail);
      const now = deps.clock.now();
      let record =
        (subjectId ? await deps.subscribers.findBySubject("shop", subjectId) : null) ??
        (await deps.subscribers.findByEmail("shop", email));
      if (!record) {
        const consent = { consentText: CONSENT_TEXT, consentSource: SOURCE };
        record = subjectId
          ? await deps.subscribers.saveConfirmedForAccount({
              product: "shop",
              email,
              subjectId,
              now,
              ...consent,
            })
          : await deps.subscribers.savePending({ product: "shop", email, now, ...consent });
      }
      const topic = (await deps.topics.list(record.id)).find(
        (t) => t.topic === BACK_IN_STOCK_TOPIC,
      );
      // A person who switched this topic off in their preferences has said no to these emails.
      const topicOff = topic?.emailOn === false;
      if (!topic) await deps.topics.setEmail(record.id, BACK_IN_STOCK_TOPIC, true, "person", now);
      const token = deps.codec.create({
        kind: "stop",
        product: "shop",
        subscriberId: record.id,
        linkVersion: record.linkVersion,
        topic: BACK_IN_STOCK_TOPIC,
      });
      return {
        subscriberId: record.id,
        stopped: record.status === "stopped" || topicOff,
        token,
        stopUrl: deps.urls.stop(token),
        oneClickUrl: deps.urls.oneClick(token),
        manageUrl: record.subjectId ? deps.urls.manage() : null,
      };
    },
  };
}
