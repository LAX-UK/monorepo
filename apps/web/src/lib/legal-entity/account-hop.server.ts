import "server-only";

import { clientAreaRedirectFor } from "@/lib/auth/client-audience";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { safeHopNext } from "@/lib/navigation/account-link";
import { decodeActingContextCookie } from "@auction/types";
import { cookies } from "next/headers";
import type { HopPlan } from "./account-hops";
import { writeAccountNoticeCookie, writeActingAccountCookie } from "./acting-cookie.server";
import { ACTING_LEGAL_ENTITY_COOKIE, parseActingLegalEntityId } from "./client-acting-context";
import { rememberAccount } from "./remembered-account.server";

/**
 * A `303 See Other` to a same-site path. Hops answer `GET` and `POST`; 303 always continues
 * with a `GET`, so a posted form is never re-posted to the destination.
 */
export function seeOther(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

/**
 * The signed-in client for a hop, or the response that sends them elsewhere: to sign in (coming
 * back to `back`), or, for staff, who have no client accounts, to their admin area.
 */
export async function hopUser(request: Request, back?: string): Promise<SessionUser | Response> {
  const user = await getServerSessionUser();
  const url = new URL(request.url);
  if (user) {
    const staffDestination = clientAreaRedirectFor(user, url.pathname);
    return staffDestination ? seeOther(staffDestination) : user;
  }
  const returnTo = back ?? `${url.pathname}${url.search}`;
  return seeOther(`/login?next=${encodeURIComponent(returnTo)}&auth=required`);
}

/** The hop's destination from `?next=`, limited to the client area. */
export function hopNext(request: Request): string {
  return safeHopNext(new URL(request.url).searchParams.get("next"));
}

/** Whether this browser is a staff member viewing as a client; hops leave that untouched. */
export async function isImpersonating(): Promise<boolean> {
  const raw = (await cookies()).get(ACTING_LEGAL_ENTITY_COOKIE)?.value;
  if (!raw) return false;
  return Boolean(decodeActingContextCookie(decodeURIComponent(raw))?.i?.sid);
}

/** The account this browser used last, from its cookie; `null` on a new device. */
export async function browserAccountId(): Promise<string | null> {
  const raw = (await cookies()).get(ACTING_LEGAL_ENTITY_COOKIE)?.value;
  return raw ? (parseActingLegalEntityId(`${ACTING_LEGAL_ENTITY_COOKIE}=${raw}`) ?? null) : null;
}

/** Carries out a hop plan: writes the account, remembers it, leaves the notice, redirects. */
export async function carryOutHop(plan: HopPlan): Promise<Response> {
  if (plan.switchTo) {
    await writeActingAccountCookie(plan.switchTo.accountId);
    if (plan.switchTo.remember) await rememberAccount(plan.switchTo.accountId);
    if (plan.switchTo.notice) await writeAccountNoticeCookie(plan.switchTo.notice);
  }
  return seeOther(plan.redirect);
}
