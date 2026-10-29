import "server-only";

import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { deriveActingContext } from "@/lib/legal-entity/derive-acting-context";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { createPendingInvitationsGateway } from "@/lib/legal-entity/pending-invitations.gateway.server";
import type { AccountMenuContext } from "./account-menu-context";
import { buildAccountChrome } from "./account-switcher-model";
import { clientNavScopeFor } from "./client-nav-scope";
import { deriveClientAttention } from "./derive-client-attention";

/** Unread notifications counted for the menu; the badge shows "9+" past this. */
const UNREAD_LIMIT = 10;

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

/**
 * Loads the facts behind the account menu, the header chip and the account sub-navigation.
 * Each count degrades to "nothing" on failure: a menu without a count for a moment is better
 * than one that blocks on a slow service. The accounts do not: without them the menu would
 * describe the wrong account, so this throws {@link AccountsUnavailableError} instead.
 */
export async function loadAccountMenuContext(user: SessionUser): Promise<AccountMenuContext> {
  const c = await getServerDataContainer();
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const [acting, submissions, invitations, bids, purchases, unread] = await Promise.allSettled([
    resolveActingContext(user.role, user.staffRoles),
    c.submissions.getSummary(),
    orgModuleEnabled ? createPendingInvitationsGateway().listMine() : Promise.resolve([]),
    c.bids.listMine(),
    c.portfolio.listMine(),
    c.notifications.listMine({ tab: "unread", limit: UNREAD_LIMIT }),
  ]);

  // Without the accounts the menu would describe the personal account; the caller keeps what it
  // showed last instead.
  if (acting.status === "rejected") throw acting.reason;
  const actingContext = acting.value;
  const safeActing = deriveActingContext({ actingContext, orgModuleEnabled }).safeActing;
  const hasConsigned = (settled(submissions, null)?.total ?? 0) > 0;
  const pendingInvitations = settled(invitations, []).length;
  const memberships = actingContext.memberships;
  const account = buildAccountChrome({
    personName: user.name.trim() || user.email,
    memberships,
    actingId: safeActing?.id ?? null,
    orgModuleEnabled,
    pendingInvitations,
  });

  return {
    hasConsigned,
    isOrgMember: account.switcher !== null,
    pendingInvitations,
    scope: clientNavScopeFor(safeActing, hasConsigned),
    accounts: account.switcher?.options ?? null,
    attention: deriveClientAttention({
      userId: user.id,
      bids: settled(bids, []),
      purchases: settled(purchases, []),
      unreadNotifications: settled(unread, []),
    }),
  };
}
