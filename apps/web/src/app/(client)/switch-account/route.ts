import { bffConfig } from "@/lib/bff/config.server";
import {
  carryOutHop,
  hopNext,
  hopUser,
  isImpersonating,
  seeOther,
} from "@/lib/legal-entity/account-hop.server";
import { planSwitchForBrowser } from "@/lib/legal-entity/switch-hop.server";
import {
  NOTIFICATION_FROM_PARAM,
  accountsUnavailableHref,
  confirmSwitchHref,
  safeHopNext,
  switchAccountHref,
} from "@/lib/navigation/account-link";
import {
  isPrefetchRequest,
  isSameOriginNavigation,
  isSameOriginWrite,
} from "@/lib/security/fetch-metadata";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Opens `next` in account `to`: switches when the person is a member (with a one-time notice),
 * otherwise shows the no-access page. `confirmed` is true for a request the person made on this
 * site; anything else that would change the account goes to the confirm page instead.
 */
async function switchHop(
  to: string | null,
  next: string,
  confirmed: boolean,
  notificationFrom: string | null = null,
): Promise<Response> {
  if (await isImpersonating()) return seeOther(next);
  const outcome = await planSwitchForBrowser(to, next, notificationFrom);
  if (outcome.kind === "unavailable") {
    // "Try again" is a link on our own page, so the retry is a same-origin GET of this hop.
    return seeOther(accountsUnavailableHref(to ? switchAccountHref(to, next) : next));
  }
  if (outcome.plan.switchTo && !confirmed) {
    return seeOther(confirmSwitchHref(outcome.plan.switchTo.accountId, next));
  }
  return carryOutHop(outcome.plan);
}

/**
 * `GET /switch-account?to=<account>&next=<page>`, for links on this site (the account menu,
 * record pages). A link from another site, or from a browser that sends no Fetch Metadata, is
 * asked to confirm first; a prefetch never changes anything.
 */
export async function GET(request: Request) {
  if (isPrefetchRequest(request.headers))
    return new Response(null, { status: 204, headers: NO_STORE });
  const signedIn = await hopUser(request);
  if (signedIn instanceof Response) return signedIn;
  const params = new URL(request.url).searchParams;
  return switchHop(
    params.get("to"),
    hopNext(request),
    isSameOriginNavigation(request.headers),
    params.get(NOTIFICATION_FROM_PARAM),
  );
}

/** `POST /switch-account` (form fields `to`, `next`): the confirm page's "Continue as …". */
export async function POST(request: Request) {
  if (!isSameOriginWrite(request.headers, bffConfig().publicOrigin)) {
    return NextResponse.json({ error: "csrf_rejected" }, { status: 403, headers: NO_STORE });
  }
  const form = await request.formData().catch(() => null);
  const field = (name: string): string | null => {
    const value = form?.get(name);
    return typeof value === "string" && value ? value : null;
  };
  const to = field("to");
  const next = safeHopNext(field("next"));
  const signedIn = await hopUser(request, to ? confirmSwitchHref(to, next) : next);
  if (signedIn instanceof Response) return signedIn;
  return switchHop(to, next, true);
}
