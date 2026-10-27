import type { NavItem } from "@/lib/shell/contracts";

export type SellerConnectNavBadgeInput = {
  connectEnforced: boolean;
  connectReady: boolean;
};

/**
 * Warning badge on Sold & payouts when payout setup is required but unfinished. Payout setup is
 * reached from there (and, for organisations, from Organisation › Payouts).
 */
export function applySellerConnectNavBadges(
  items: readonly NavItem[],
  input: SellerConnectNavBadgeInput | null | undefined,
): NavItem[] {
  if (!input?.connectEnforced || input.connectReady) {
    return [...items];
  }
  return items.map((item) =>
    item.id === "payouts" ? { ...item, badge: 1, badgeTone: "warning" as const } : item,
  );
}
