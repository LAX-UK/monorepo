import type { BidderAttentionGroup } from "@auction/domain";
import { CLIENT_ROUTES } from "./client-routes";

/**
 * What is waiting for the person across their Bid pages. It drives the header chip and the
 * counts in the account menu and sub-navigation, so all three always agree.
 */
export type ClientAttention = {
  /**
   * Lots in a live sale where someone has outbid them, soonest to close first, by catalogue
   * number ("14"); `null` for a lot not numbered yet.
   */
  outbidLots: readonly (string | null)[];
  /** Won lots still to pay for. */
  paymentsDue: number;
  unreadNotifications: number;
  /**
   * The same prompts named by the work, with a link and a count per kind. The chip, the menu and
   * the Needs action list can say "Outbid on Estuary, evening" instead of a lot number that
   * repeats across sales.
   */
  groups: readonly BidderAttentionGroup[];
};

export const NO_ATTENTION: ClientAttention = {
  outbidLots: [],
  paymentsDue: 0,
  unreadNotifications: 0,
  groups: [],
};

/** How a count reads next to a page's name. */
export type AttentionCount = {
  value: number;
  /** Outbid is urgent while the sale runs; everything else is a plain to-do. */
  tone: "danger" | "neutral";
  /** The count in words ("1 outbid", "2 to pay"), for screen readers and the menu. */
  label: string;
  /** The menu shows a to-pay count as words, the others as a badge. */
  menuStyle: "badge" | "text";
};

type CountRule = (attention: ClientAttention) => AttentionCount | null;

function count(
  value: number,
  tone: AttentionCount["tone"],
  label: string,
  menuStyle: AttentionCount["menuStyle"] = "badge",
): AttentionCount | null {
  return value > 0 ? { value, tone, label, menuStyle } : null;
}

/** Which menu entries carry a count, keyed by the entry id in the client nav model. */
const COUNT_RULES: Readonly<Record<string, CountRule>> = {
  bids: (a) => count(a.outbidLots.length, "danger", `${a.outbidLots.length} outbid`),
  purchases: (a) => count(a.paymentsDue, "neutral", `${a.paymentsDue} to pay`, "text"),
  notifications: (a) => count(a.unreadNotifications, "neutral", `${a.unreadNotifications} unread`),
};

/** The count for one menu entry, or `null` when nothing there is due. */
export function attentionCountFor(
  itemId: string,
  attention: ClientAttention,
): AttentionCount | null {
  return COUNT_RULES[itemId]?.(attention) ?? null;
}

/** The header chip: one short, urgent prompt with a link to where it is resolved. */
export type AttentionChip = {
  kind: "outbid" | "payment-due";
  /** "Outbid on Harbour at Dawn", or "Outbid on 2 lots" when several are waiting. */
  label: string;
  href: string;
  /** What assistive technology hears: the full text, even when the chip truncates it. */
  accessibleName: string;
};

type ChipRule = {
  kind: AttentionChip["kind"];
  applies: (attention: ClientAttention) => boolean;
  chip: (attention: ClientAttention) => Omit<AttentionChip, "kind">;
};

/** Where the several outbid lots are resolved together. */
const OUTBID_LIST_HREF = `${CLIENT_ROUTES.bids}?tab=active`;

/**
 * The chip names the work, not the lot number, which repeats across sales. One lot links straight
 * to its price block; several collapse to a count and link to My bids.
 */
function outbidChip(attention: ClientAttention): Omit<AttentionChip, "kind"> {
  const group = attention.groups.find((candidate) => candidate.kind === "outbid");
  const only = group?.items.length === 1 ? group.items[0] : undefined;
  const count = group?.count ?? attention.outbidLots.length;
  if (only) {
    const label = `Outbid on ${only.title}`;
    return { label, href: only.url, accessibleName: `${label}. Go to the lot` };
  }
  const label = count === 1 ? "Outbid on 1 lot" : `Outbid on ${count} lots`;
  return { label, href: OUTBID_LIST_HREF, accessibleName: `${label}. Go to My bids` };
}

/** In priority order: being outbid wins while a sale is live; payment waits a little longer. */
const CHIP_RULES: readonly ChipRule[] = [
  {
    kind: "outbid",
    applies: (a) => a.outbidLots.length > 0,
    chip: outbidChip,
  },
  {
    kind: "payment-due",
    applies: (a) => a.paymentsDue > 0,
    chip: () => ({
      label: "Payment due",
      href: CLIENT_ROUTES.purchases,
      accessibleName: "Payment due. Go to Purchases",
    }),
  },
];

/** The chip to show, or `null` when nothing is pressing. */
export function attentionChip(attention: ClientAttention): AttentionChip | null {
  const rule = CHIP_RULES.find((candidate) => candidate.applies(attention));
  return rule ? { kind: rule.kind, ...rule.chip(attention) } : null;
}
