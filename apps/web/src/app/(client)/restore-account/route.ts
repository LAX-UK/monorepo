import {
  browserAccountId,
  carryOutHop,
  hopNext,
  hopUser,
  isImpersonating,
  seeOther,
} from "@/lib/legal-entity/account-hop.server";
import { planRestoreHop } from "@/lib/legal-entity/account-hops";
import { writeRestoreMarkerCookie } from "@/lib/legal-entity/acting-cookie.server";
import { restoreAccount } from "@/lib/legal-entity/remembered-account.server";
import { accountsUnavailableHref, restoreAccountHref } from "@/lib/navigation/account-link";
import { isPrefetchRequest } from "@/lib/security/fetch-metadata";

export const dynamic = "force-dynamic";

/**
 * `/restore-account?next=<page>`: a browser with no usable account choice (an organisation the
 * person has left, or a cookie cleared mid-session) opens in the account they used last, or in
 * their own with a notice saying why. A new sign-in does this in the sign-in callback; this is
 * the fallback, and it is always opened as a page, never by the client router. When the API
 * cannot answer, the browser keeps its choice and the person sees the retry state; it is never
 * moved to the personal account on a guess.
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
  // If the page after this still asks for a restore, the layout stops instead of looping.
  await writeRestoreMarkerCookie();
  return carryOutHop(planRestoreHop({ next, restored: answer.restored }));
}
