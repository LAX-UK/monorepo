import "server-only";

import { clientAreaRedirectFor } from "@/lib/auth/client-audience";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { safeHopNext } from "@/lib/navigation/account-link";
import { decodeActingContextCookie } from "@auction/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { HopPlan } from "./account-hops";
import { writeAccountNoticeCookie, writeActingAccountCookie } from "./acting-cookie.server";
import { ACTING_LEGAL_ENTITY_COOKIE, parseActingLegalEntityId } from "./client-acting-context";
import { rememberAccount } from "./remembered-account.server";

/**
 * The signed-in client for a hop, or a redirect: to sign in (coming back to the same hop), or,
 * for staff, who have no client accounts, to their admin area.
 */
export async function requireHopUser(request: Request) {
  const user = await getServerSessionUser();
  const url = new URL(request.url);
  if (user) {
    const staffDestination = clientAreaRedirectFor(user, url.pathname);
    if (staffDestination) redirect(staffDestination);
    return user;
  }
  const back = `${url.pathname}${url.search}`;
  redirect(`/login?next=${encodeURIComponent(back)}&auth=required`);
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
export async function carryOutHop(plan: HopPlan): Promise<never> {
  if (plan.switchTo) {
    await writeActingAccountCookie(plan.switchTo.accountId);
    if (plan.switchTo.remember) await rememberAccount(plan.switchTo.accountId);
    if (plan.switchTo.notice) await writeAccountNoticeCookie(plan.switchTo.notice);
  }
  redirect(plan.redirect);
}
