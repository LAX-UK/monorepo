import type { SessionHandle } from "./portfolio-gateway";

/** The alert emails a person switches themselves, one per topic of a product. */
export const ALERT_TOPIC_IDS = [
  "bid.new_sales",
  "bid.artists",
  "bid.searches",
  "shop.releases",
  "art.followed_artists",
] as const;
export type AlertTopicId = (typeof ALERT_TOPIC_IDS)[number];

/** The products that hold alerts. LAX Shop and lax.art share Shop's API. */
export type AlertSourceId = "bid" | "shop";

export type TopicState = { topic: AlertTopicId; emailOn: boolean };

/** What one product answered: the person's switches, or that it could not answer at all. */
export type AlertSourceRead =
  | {
      status: "ok";
      topics: TopicState[];
      /** Editions the person asked to hear about when they are available again (Shop only). */
      waitingEditions?: number;
    }
  | { status: "unavailable" };

export type AlertPreferencesRead = Record<AlertSourceId, AlertSourceRead>;

/** Why a switch could not be turned on. */
export type AlertSwitchRefusal = "unverified" | "blocked" | "no_account";

export type AlertSwitchResult =
  | { status: "ok" }
  | { status: "refused"; reason: AlertSwitchRefusal }
  | { status: "signed_out" }
  | { status: "unavailable" };

/**
 * Reads and switches a person's alert emails in every product that sends them. Each product
 * answers independently: one that fails is reported unavailable and never hides the rest.
 */
export type AlertPreferencesGateway = {
  read(handle: SessionHandle): Promise<AlertPreferencesRead>;
  setTopic(
    handle: SessionHandle,
    change: { topic: AlertTopicId; on: boolean },
  ): Promise<AlertSwitchResult>;
};
