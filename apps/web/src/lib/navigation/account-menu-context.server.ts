import "server-only";

import { getServerDataContainer } from "@/lib/data/container.server";
import { laxAccountPortalOrigin } from "@/lib/lax-account-portal-redirect.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import type { AccountMenuContext } from "./account-menu-context";

/**
 * Loads the facts behind the account menu. Each lookup degrades to "no" on failure: a menu
 * that offers "Start selling" for a moment is better than one that blocks on a slow service.
 */
export async function loadAccountMenuContext(): Promise<AccountMenuContext> {
  const c = await getServerDataContainer();
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const [memberships, submissions] = await Promise.allSettled([
    orgModuleEnabled ? c.legalEntities.listMine() : Promise.resolve([]),
    c.submissions.getSummary(),
  ]);
  return {
    hasConsigned: submissions.status === "fulfilled" && submissions.value.total > 0,
    isOrgMember:
      memberships.status === "fulfilled" &&
      memberships.value.some((m) => m.kind === "organisation"),
    accountOrigin: laxAccountPortalOrigin(),
  };
}
