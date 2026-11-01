import { lotPath } from "@auction/types";

/**
 * What is waiting for a bidder on specific lots, named by the work rather than the lot number
 * (which repeats across sales). The header chip, the menu counts and the Needs action list read
 * the same items, so they never disagree.
 */

export type BidderAttentionKind = "outbid" | "payment_due";

export type BidderAttentionFact = {
  kind: BidderAttentionKind;
  lotId: string;
  title: string;
};

export type BidderAttentionItem = BidderAttentionFact & {
  /** Where the prompt is resolved: the lot's price block. */
  url: string;
};

export type BidderAttentionGroup = {
  kind: BidderAttentionKind;
  count: number;
  items: BidderAttentionItem[];
  /** One item links straight to its lot; several link to the list that holds them. */
  url: string;
};

type KindRule = {
  /** Where several items of this kind are resolved together. */
  listUrl: string;
  /** Where one item is resolved. */
  itemUrl(fact: BidderAttentionFact): string;
};

/** In priority order: being outbid while a sale runs beats a payment that waits. */
const KIND_RULES: readonly (readonly [BidderAttentionKind, KindRule])[] = [
  [
    "outbid",
    {
      listUrl: "/bids?tab=active",
      itemUrl: (fact) => `${lotPath({ id: fact.lotId, title: fact.title })}#price`,
    },
  ],
  ["payment_due", { listUrl: "/purchases", itemUrl: () => "/purchases" }],
];

/** Groups the facts by kind, in priority order, with a count and a link for each group. */
export function groupBidderAttention(
  facts: readonly BidderAttentionFact[],
): BidderAttentionGroup[] {
  const groups: BidderAttentionGroup[] = [];
  for (const [kind, rule] of KIND_RULES) {
    const seen = new Set<string>();
    const items: BidderAttentionItem[] = [];
    for (const fact of facts) {
      if (fact.kind !== kind || seen.has(fact.lotId)) continue;
      seen.add(fact.lotId);
      items.push({ ...fact, url: rule.itemUrl(fact) });
    }
    const only = items.length === 1 ? items[0] : undefined;
    if (items.length > 0) {
      groups.push({ kind, count: items.length, items, url: only ? only.url : rule.listUrl });
    }
  }
  return groups;
}
