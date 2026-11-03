import type { MatchSnapshot, PendingMatch } from "./match.js";
import type { AlertTopic } from "./products.js";
import { TOPIC_CATALOGUE } from "./topic-catalogue.js";

export const MAX_ITEMS_PER_GROUP = 6;

export type DigestItem = {
  title: string;
  subtitle: string | null;
  detail: string | null;
  imageUrl: string | null;
  path: string;
};

export type DigestSubgroup = {
  label: string | null;
  criteria: string | null;
  items: DigestItem[];
};

export type DigestGroup = {
  topic: AlertTopic;
  heading: string;
  subgroups: DigestSubgroup[];
  /** Every match in the group, including those past the shown limit. */
  total: number;
  /** True when some matches are not listed, so the email links to all of them. */
  truncated: boolean;
};

export type DigestVm = {
  subject: string;
  groups: DigestGroup[];
  totalItems: number;
};

function toItem(s: MatchSnapshot): DigestItem {
  return {
    title: s.title,
    subtitle: s.subtitle ?? null,
    detail: s.detail ?? null,
    imageUrl: s.imageUrl ?? null,
    path: s.path,
  };
}

function groupOf(topic: AlertTopic, matches: PendingMatch[], limit: number): DigestGroup {
  const ordered = [...matches].sort(
    (a, b) => a.matchedAt.getTime() - b.matchedAt.getTime() || a.itemKey.localeCompare(b.itemKey),
  );
  const subgroups = new Map<string, DigestSubgroup>();
  let shown = 0;
  for (const match of ordered) {
    if (shown >= limit) break;
    const key = match.groupKey ?? "";
    let sub = subgroups.get(key);
    if (!sub) {
      sub = {
        label: match.snapshot.groupLabel ?? null,
        criteria: match.snapshot.groupCriteria ?? null,
        items: [],
      };
      subgroups.set(key, sub);
    }
    sub.items.push(toItem(match.snapshot));
    shown += 1;
  }
  return {
    topic,
    heading: TOPIC_CATALOGUE[topic].heading,
    subgroups: [...subgroups.values()],
    total: ordered.length,
    truncated: ordered.length > shown,
  };
}

function plural(count: number, noun: { one: string; many: string }): string {
  return `${count} ${count === 1 ? noun.one : noun.many}`;
}

/**
 * The subject leads with the strongest group (a new sale beats a lot) and counts the rest. With
 * one topic it is that topic's own line.
 */
function subjectFor(groups: DigestGroup[]): string {
  const [lead, ...rest] = groups;
  if (!lead) return "";
  const def = TOPIC_CATALOGUE[lead.topic];
  const first = lead.subgroups[0]?.items[0];
  const leadLine =
    lead.total === 1 && first ? def.subjectForOne(first.title) : def.subjectForMany(lead.total);
  const restCount = rest.reduce((n, g) => n + g.total, 0);
  if (restCount === 0) return leadLine;
  const nouns = new Set(rest.map((g) => TOPIC_CATALOGUE[g.topic].noun.many));
  const noun =
    nouns.size === 1
      ? (rest[0] && TOPIC_CATALOGUE[rest[0].topic].noun) || { one: "alert", many: "alerts" }
      : { one: "alert", many: "alerts" };
  return `${leadLine}, and ${plural(restCount, noun)} for you`;
}

/**
 * Turns a person's pending matches into the digest they will read: groups in priority order, at
 * most `limit` items listed per group with the true total beside it, and a subject that leads with
 * the strongest item. Returns null when there is nothing to say, so no empty email is ever sent.
 */
export function assembleDigest(
  matches: readonly PendingMatch[],
  limit: number = MAX_ITEMS_PER_GROUP,
): DigestVm | null {
  if (matches.length === 0) return null;
  const byTopic = new Map<AlertTopic, PendingMatch[]>();
  for (const match of matches) {
    const list = byTopic.get(match.topic) ?? [];
    list.push(match);
    byTopic.set(match.topic, list);
  }
  const groups = [...byTopic.entries()]
    .sort(([a], [b]) => TOPIC_CATALOGUE[b].priority - TOPIC_CATALOGUE[a].priority)
    .map(([topic, list]) => groupOf(topic, list, limit));
  return { subject: subjectFor(groups), groups, totalItems: matches.length };
}
