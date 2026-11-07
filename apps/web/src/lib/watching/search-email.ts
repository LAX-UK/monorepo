import { setAlertTopic } from "@/lib/data/http/alerts.client";
import { setSavedSearchEmail } from "@/lib/data/http/saved-searches.client";

export type SearchEmailResult = { ok: true } | { ok: false; error: string };

export type SearchEmailPorts = {
  setSearch: (id: string, on: boolean) => Promise<boolean>;
  /** Makes sure the saved-search alerts topic delivers email. */
  enableTopicEmail: () => Promise<SearchEmailResult>;
};

const httpPorts: SearchEmailPorts = {
  setSearch: setSavedSearchEmail,
  enableTopicEmail: () => setAlertTopic("bid.searches", true, { email: true }),
};

/**
 * Turns email on or off for one saved search. Turning it on also makes sure the saved-search
 * alerts topic delivers email, since a search's switch only counts while the topic's is on;
 * turning it off leaves the topic alone, because other searches may still use it. With no id
 * (a search saved a moment ago, with email already on) only the topic is switched on.
 */
export async function switchSearchEmail(
  id: string | null,
  on: boolean,
  ports: SearchEmailPorts = httpPorts,
): Promise<SearchEmailResult> {
  if (on) {
    const topic = await ports.enableTopicEmail();
    if (!topic.ok) return topic;
  }
  if (id === null) return { ok: true };
  const saved = await ports.setSearch(id, on);
  return saved
    ? { ok: true }
    : { ok: false, error: "We couldn't save that change. Try again in a moment." };
}
