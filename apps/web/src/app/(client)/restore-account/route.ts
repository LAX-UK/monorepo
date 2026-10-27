import {
  browserAccountId,
  carryOutHop,
  hopNext,
  isImpersonating,
  requireHopUser,
} from "@/lib/legal-entity/account-hop.server";
import { planRestoreHop } from "@/lib/legal-entity/account-hops";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { restoreAccount } from "@/lib/legal-entity/remembered-account.server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * `/restore-account?next=<page>`: a browser with no usable account choice (a new device, or an
 * organisation the person has left) opens in the account they used last, or in their own with a
 * notice saying why.
 */
export async function GET(request: Request) {
  const user = await requireHopUser(request);
  const next = hopNext(request);
  if (await isImpersonating()) redirect(next);

  const [restored, context] = await Promise.all([
    restoreAccount(await browserAccountId()),
    resolveActingContext(user.role, user.staffRole ?? null),
  ]);
  const personalId = context.memberships.find((m) => m.kind === "individual")?.id ?? null;
  return carryOutHop(planRestoreHop({ next, restored, personalId }));
}
