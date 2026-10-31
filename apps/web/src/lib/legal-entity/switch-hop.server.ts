import "server-only";

import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import type { LegalEntitySummary } from "@auction/types";
import { browserAccountId } from "./account-hop.server";
import { type HopPlan, planSwitchHop } from "./account-hops";
import { listMyAccounts } from "./acting-context.server";
import { chooseActingAccount } from "./choose-acting-account";

/** A switch hop's plan with the accounts it was made from, or `unavailable` (never a guess). */
export type SwitchHopOutcome =
  | {
      kind: "plan";
      plan: HopPlan;
      /** The account the browser uses now, when it has a usable one. */
      current: LegalEntitySummary | null;
      /** The account the link asks for, when the person may use it. */
      requested: LegalEntitySummary | null;
    }
  | { kind: "unavailable" };

/**
 * What opening `next` in account `requestedId` does for this browser: read the person's accounts
 * (re-reading a cached answer that lacks `requestedId`, so a just-accepted invitation counts),
 * then plan the hop. The route handlers and the confirm page carry the plan out or ask first.
 */
export async function planSwitchForBrowser(
  requestedId: string | null,
  next: string,
  notificationFrom: string | null = null,
): Promise<SwitchHopOutcome> {
  const [lookup, orgModuleEnabled, browserId] = await Promise.all([
    listMyAccounts({ mustInclude: requestedId }),
    resolveOrgModuleEnabledFromRequest(),
    browserAccountId(),
  ]);
  if (!lookup.ok) return { kind: "unavailable" };
  const choice = chooseActingAccount({
    accounts: lookup.accounts,
    browserAccountId: browserId,
    orgModuleEnabled,
  });
  const current = choice && !choice.needsRestore ? choice.acting : null;
  const plan = planSwitchHop({
    requestedId,
    next,
    actingId: current?.id ?? null,
    memberships: lookup.accounts,
    orgModuleEnabled,
    notificationFrom,
  });
  const requested = plan.switchTo
    ? (lookup.accounts.find((account) => account.id === plan.switchTo?.accountId) ?? null)
    : null;
  return { kind: "plan", plan, current, requested };
}
