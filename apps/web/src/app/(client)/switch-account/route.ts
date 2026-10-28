import {
  carryOutHop,
  hopNext,
  isImpersonating,
  requireHopUser,
} from "@/lib/legal-entity/account-hop.server";
import { planSwitchHop } from "@/lib/legal-entity/account-hops";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * `/switch-account?to=<account>&next=<page>`: opens a page in the account it belongs to. A member
 * is switched (with a one-time notice); anyone else sees the no-access page.
 */
export async function GET(request: Request) {
  const user = await requireHopUser(request);
  const next = hopNext(request);
  if (await isImpersonating()) redirect(next);

  const [context, orgModuleEnabled] = await Promise.all([
    resolveActingContext(user.role, user.staffRoles),
    resolveOrgModuleEnabledFromRequest(),
  ]);
  return carryOutHop(
    planSwitchHop({
      requestedId: new URL(request.url).searchParams.get("to"),
      next,
      actingId: context.needsRestore ? null : (context.acting?.id ?? null),
      memberships: context.memberships,
      orgModuleEnabled,
    }),
  );
}
