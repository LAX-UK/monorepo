import type { SessionUser } from "@/lib/data/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import {
  type UserRole,
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
} from "@auction/types";

export type AccountMenuEntry = {
  id: string;
  label: string;
  href: string;
  /** Leaves Bid (the LAX Account origin), so it opens as a plain link. */
  external?: true;
};

/** Facts about the person that decide which entries the menu offers. */
export type AccountMenuFacts = {
  /** Which workspace they are in; selling shows a way back to buying. */
  mode: ClientWorkspaceMode;
  /** They have submitted work to sell. */
  hasConsigned: boolean;
  /** They belong to at least one organisation and organisations are switched on. */
  isOrgMember: boolean;
  /** The LAX Account origin; the link is hidden when unset. */
  accountOrigin: string | null;
  user: Pick<SessionUser, "role" | "staffRole">;
};

/** Where LAX Account opens when arriving from Bid, so it can offer a way back. */
export function laxAccountHref(origin: string): string {
  return `${origin}/account?from=bid`;
}

const PRIMARY: readonly AccountMenuEntry[] = [
  { id: "bids", label: "My bids", href: "/dashboard/bids" },
  { id: "purchases", label: "Purchases", href: "/dashboard/purchases" },
  { id: "watching", label: "Watching", href: "/dashboard/watchlist" },
  { id: "notifications", label: "Notifications", href: "/dashboard/notifications" },
];

function sellingEntry(facts: AccountMenuFacts): AccountMenuEntry {
  if (facts.mode === "selling") {
    return { id: "buying", label: "Back to buying", href: "/dashboard/bids" };
  }
  if (facts.hasConsigned || facts.isOrgMember) {
    return { id: "selling", label: "Selling", href: "/dashboard/seller" };
  }
  return { id: "start-selling", label: "Start selling", href: "/dashboard/submissions/new" };
}

function staffEntry(user: AccountMenuFacts["user"]): AccountMenuEntry | null {
  const role = user.role as UserRole;
  const staff = user.staffRole ?? null;
  if (canAccessPlatformAdminRoutes(role, staff)) {
    return { id: "admin", label: "Admin panel", href: "/admin" };
  }
  if (canAccessFinanceAdminRoutes(role, staff)) {
    return { id: "finance-admin", label: "Finance admin", href: "/admin/payments" };
  }
  return null;
}

/**
 * The signed-in account menu as groups separated by a divider: everyday pages first, then
 * mode and organisation switches, then account and settings.
 * Sign out is rendered by the host menu after the last group.
 */
export function buildAccountMenu(facts: AccountMenuFacts): AccountMenuEntry[][] {
  const switches: AccountMenuEntry[] = [sellingEntry(facts)];
  if (facts.isOrgMember) {
    switches.push({
      id: "organisations",
      label: "Your organisations",
      href: "/dashboard/organisations",
    });
  }
  const staff = staffEntry(facts.user);
  if (staff) switches.push(staff);

  const account: AccountMenuEntry[] = [];
  if (facts.accountOrigin) {
    account.push({
      id: "lax-account",
      label: "LAX Account",
      href: laxAccountHref(facts.accountOrigin),
      external: true,
    });
  }
  account.push({ id: "settings", label: "Bid settings", href: "/dashboard/settings/bidding" });

  return [[...PRIMARY], switches, account];
}
