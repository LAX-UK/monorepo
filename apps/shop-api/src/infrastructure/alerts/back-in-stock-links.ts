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
  /**
   * The person stopped LAX Shop alerts, or this topic, after they asked: nothing more is sent for
   * that request. A Notify me pressed after the stop is fresh consent and is sent; an address
   * that complained is never written to again.
   */
  stopped: boolean;
  /** The signed stop token for this topic: the shared alert engine's link. */
  token: string;
  stopUrl: string;
  oneClickUrl: string;
  /** Where an account holder manages their alerts; null for a guest. */
  manageUrl: string | null;
};

/** When a person last said no to back in stock emails, for comparing with when they asked. */
export interface BackInStockStopTimes {
  /**
   * The later of when the subscriber stopped all Shop alerts (while it is still stopped) and when
   * the back in stock topic was switched off (while it is still off); null when neither holds.
   */
  stoppedSince(subscriberId: string): Promise<Date | null>;
}

export type BackInStockLinks = {
  /**
   * The engine link for a back-in-stock email, creating the person's engine row when they have
   * none. An account with a verified address is recorded as confirmed; a guest's unverified
   * address is only recorded as pending, which is enough for a stop link and never receives
   * release alerts. `requestedAt` is when the person pressed Notify me.
   */
  linkFor(input: {
    email: string;
    subjectId: string | null;
    requestedAt: Date;
  }): Promise<BackInStockLink>;
  /**
   * The stop token for a person's existing engine row, or null when they have none. Reads only:
   * a mail scanner opening an old link must not create rows or record consent.
   */
  existingStopToken(input: { email: string; subjectId: string | null }): Promise<string | null>;
};

export function createBackInStockLinks(deps: {
  subscribers: SubscriberStore;
  topics: TopicStore;
  stopTimes: BackInStockStopTimes;
  codec: AlertLinkCodec;
  urls: AlertUrls;
  clock: Clock;
}): BackInStockLinks {
  const find = async (email: string, subjectId: string | null) =>
    (subjectId ? await deps.subscribers.findBySubject("shop", subjectId) : null) ??
    (await deps.subscribers.findByEmail("shop", email));
  const stopTokenFor = (record: { id: string; linkVersion: number }) =>
    deps.codec.create({
      kind: "stop",
      product: "shop",
      subscriberId: record.id,
      linkVersion: record.linkVersion,
      topic: BACK_IN_STOCK_TOPIC,
    });

  return {
    async existingStopToken({ email, subjectId }) {
      const record = await find(normaliseAlertEmail(email), subjectId);
      return record ? stopTokenFor(record) : null;
    },

    async linkFor({ email: rawEmail, subjectId, requestedAt }) {
      const email = normaliseAlertEmail(rawEmail);
      const now = deps.clock.now();
      let record = await find(email, subjectId);
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
      if (!topic) await deps.topics.setEmail(record.id, BACK_IN_STOCK_TOPIC, true, "person", now);
      // A stop (all Shop alerts, or this topic in preferences or from a link) covers the requests
      // made before it. Pressing Notify me afterwards asks again, so that request is sent. A
      // complaint is different: the address is never written to again.
      const complained = record.status === "stopped" && record.stopReason === "complaint";
      const since = complained ? null : await deps.stopTimes.stoppedSince(record.id);
      const token = stopTokenFor(record);
      return {
        subscriberId: record.id,
        stopped: complained || (since !== null && requestedAt.getTime() <= since.getTime()),
        token,
        stopUrl: deps.urls.stop(token),
        oneClickUrl: deps.urls.oneClick(token),
        manageUrl: record.subjectId ? deps.urls.manage() : null,
      };
    },
  };
}
