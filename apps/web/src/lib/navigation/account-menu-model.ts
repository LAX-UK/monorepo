import { usesBidAsClient } from "@/lib/auth/client-audience";
import type { SessionUser } from "@/lib/data/contracts";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import {
  type UserRole,
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  staffRoleDefaultDestination,
} from "@auction/types";
import { pendingInvitationsLabel } from "./account-switcher-model";
import { CLIENT_ROUTES } from "./client-routes";

export type AccountMenuEntry = {
  id: string;
  label: string;
  href: string;
  /** Leaves Bid (the LAX Account origin), so it opens as a plain link. */
  external?: true;
};

/** Facts about the person that decide which entries the menu offers. */
export type AccountMenuFacts = {
  /** They have submitted work to sell. */
  hasConsigned: boolean;
  /** They belong to at least one organisation and organisations are switched on. */
  isOrgMember: boolean;
  /** Organisation invitations waiting for an answer. */
  pendingInvitations: number;
  user: Pick<SessionUser, "role" | "staffRole">;
};

const PRIMARY: readonly AccountMenuEntry[] = [
  { id: "bids", label: "My bids", href: "/bids" },
  { id: "purchases", label: "Purchases", href: "/purchases" },
  { id: "watching", label: "Watching", href: "/watching" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
];

/** Sellers go to their selling overview; everyone else is offered one way to start. */
function sellingEntry(facts: AccountMenuFacts): AccountMenuEntry {
  if (facts.hasConsigned || facts.isOrgMember) {
    return { id: "selling", label: "Selling", href: CLIENT_ROUTES.selling };
  }
  return { id: "start-selling", label: "Sell with LAX", href: CLIENT_ROUTES.sellingNew };
}

/** The admin area this staff member works in, or `null` when their role opens none. */
function staffEntry(user: AccountMenuFacts["user"]): AccountMenuEntry | null {
  const role = user.role as UserRole;
  const staff = user.staffRole ?? null;
  const href = staffRoleDefaultDestination(role, staff);
  if (canAccessPlatformAdminRoutes(role, staff)) {
    return { id: "admin", label: "Admin panel", href };
  }
  if (canAccessFinanceAdminRoutes(role, staff)) {
    return { id: "finance-admin", label: "Finance admin", href };
  }
  return null;
}

const LAX_ACCOUNT_ENTRY = (): AccountMenuEntry => ({
  id: "lax-account",
  label: "LAX Account",
  href: laxAccountHomeUrl(),
  external: true,
});

/** A staff account's menu: where they work, then LAX Account. */
function buildStaffMenu(facts: AccountMenuFacts): AccountMenuEntry[][] {
  const admin = staffEntry(facts.user);
  return [...(admin ? [[admin]] : []), [LAX_ACCOUNT_ENTRY()]];
}

/**
 * The signed-in account menu as groups separated by a divider: everyday pages first, then
 * selling and organisations, then account and settings.
 * Sign out is rendered by the host menu after the last group.
 */
export function buildAccountMenu(facts: AccountMenuFacts): AccountMenuEntry[][] {
  if (!usesBidAsClient(facts.user)) return buildStaffMenu(facts);
  const switches: AccountMenuEntry[] = [sellingEntry(facts)];
  if (facts.isOrgMember) {
    switches.push({
      id: "organisations",
      label: "Your organisations",
      href: "/organisations",
    });
  } else if (facts.pendingInvitations > 0) {
    // Members answer invitations from the account switcher; everyone else needs a way in here.
    switches.push({
      id: "pending-invitations",
      label: pendingInvitationsLabel(facts.pendingInvitations),
      href: CLIENT_ROUTES.invitations,
    });
  }

  // Profile, security and addresses are managed in LAX Account; Bid keeps only its own settings.
  const account: AccountMenuEntry[] = [
    LAX_ACCOUNT_ENTRY(),
    { id: "settings", label: "Bid settings", href: "/settings" },
  ];

  return [[...PRIMARY], switches, account];
}
