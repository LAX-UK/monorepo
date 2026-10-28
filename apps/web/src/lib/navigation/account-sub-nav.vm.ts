import { type ClientAttention, NO_ATTENTION, attentionCountFor } from "./client-attention";
import { type ClientNavScope, currentNavEntryId, getClientSubNav } from "./client-nav-model";

export type AccountSubNavItemVm = {
  id: string;
  label: string;
  href: string;
  count: { value: number; tone: "danger" | "neutral"; label: string } | null;
};

export type AccountSubNavVm = {
  items: AccountSubNavItemVm[];
  /** The link for the page in view, or `null` on a page outside the row (an invitation). */
  currentId: string | null;
};

/**
 * The account sub-navigation for the account in use: its links from the client nav model,
 * the current one, and a count wherever something is due. Before the facts load (`null`
 * attention) it shows no counts rather than stale ones.
 */
export function buildAccountSubNav(input: {
  scope: ClientNavScope;
  pathname: string;
  attention: ClientAttention | null;
}): AccountSubNavVm {
  const entries = getClientSubNav(input.scope);
  const attention = input.attention ?? NO_ATTENTION;
  return {
    items: entries.map((entry) => {
      const count = attentionCountFor(entry.id, attention);
      return {
        id: entry.id,
        label: entry.label,
        href: entry.href,
        count: count ? { value: count.value, tone: count.tone, label: count.label } : null,
      };
    }),
    currentId: currentNavEntryId(entries, input.pathname),
  };
}
