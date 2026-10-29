import {
  browserAccountId,
  carryOutHop,
  hopNext,
  hopUser,
  isImpersonating,
  seeOther,
} from "@/lib/legal-entity/account-hop.server";
import { planRestoreHop } from "@/lib/legal-entity/account-hops";
import { restoreAccount } from "@/lib/legal-entity/remembered-account.server";
import { accountsUnavailableHref, restoreAccountHref } from "@/lib/navigation/account-link";
import { isPrefetchRequest } from "@/lib/security/fetch-metadata";

export const dynamic = "force-dynamic";

/**
 * `/restore-account?next=<page>`: a browser with no usable account choice (a new device, or an
 * organisation the person has left) opens in the account they used last, or in their own with a
 * notice saying why. When the API cannot answer, the browser keeps its choice and the person
 * sees the retry state; it is never moved to the personal account on a guess.
 */
export async function GET(request: Request) {
  if (isPrefetchRequest(request.headers)) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  const signedIn = await hopUser(request);
  if (signedIn instanceof Response) return signedIn;
  const next = hopNext(request);
  if (await isImpersonating()) return seeOther(next);

  const answer = await restoreAccount(await browserAccountId());
  if (!answer.ok) return seeOther(accountsUnavailableHref(restoreAccountHref(next)));
  return carryOutHop(planRestoreHop({ next, restored: answer.restored }));
}
