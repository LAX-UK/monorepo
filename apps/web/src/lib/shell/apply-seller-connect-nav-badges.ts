import type { NavItem } from "@/lib/shell/contracts";

export type SellerConnectNavBadgeInput = {
  connectEnforced: boolean;
  connectReady: boolean;
};

/** Warning badge on Payout setup when connect is enforced but not ready. */
export function applySellerConnectNavBadges(
  items: readonly NavItem[],
  input: SellerConnectNavBadgeInput | null | undefined,
): NavItem[] {
  if (!input?.connectEnforced || input.connectReady) {
    return [...items];
  }
  return items.map((item) =>
    item.id === "connect" ? { ...item, badge: 1, badgeTone: "warning" as const } : item,
  );
}
