import "server-only";

import { usesBidAsClient } from "@/lib/auth/client-audience";
import { BID_API_AUDIENCE } from "@/lib/bff/config.server";
import { BidBffTokenService } from "@/lib/bff/token-service.server";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { deriveSsrOrigin } from "@/lib/data/http/server-request-headers";
import { sessionUserSchema } from "@/lib/data/http/session.schema";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { NextRequest, NextResponse } from "next/server";
import { type HopPlan, planRestoreHop } from "./account-hops";
import { cookiesForHop } from "./acting-cookie.server";
import { ACTING_LEGAL_ENTITY_COOKIE, readActingCookie } from "./client-acting-context";
import { type ApiSender, restoreAccountVia } from "./remembered-account.server";

/** Sign-in must not wait on this: past it, the layout restores the account on the first page. */
const RESTORE_TIMEOUT_MS = 3_000;

/**
 * Asks the API as `sessionId`. The session cookie is only on the response being built at sign-in,
 * so the request cannot be authenticated from cookies the way a page request is.
 */
function senderFor(sessionId: string): ApiSender {
  return async (path, init) => {
    try {
      const { token } = await new BidBffTokenService().resourceToken(
        sessionId,
        BID_API_AUDIENCE,
        "bid.read bid.write",
      );
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Origin", await deriveSsrOrigin());
      const res = await fetch(`${getServerApiBase()}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(RESTORE_TIMEOUT_MS),
      });
      if (!res.ok) console.warn(`Sign-in account restore: the API answered ${res.status}`);
      return res;
    } catch (error) {
      console.warn("Sign-in account restore failed", error);
      throw error;
    }
  };
}

/** The account to write on the sign-in redirect, and the notice to leave, if any. */
export type SignInAccount = NonNullable<HopPlan["switchTo"]>;

/**
 * The account a person opens Bid as right after signing in, so the first page already has it and
 * the browser never needs the restore hop. It is the account their profile remembers on any
 * device (never this browser's old cookie, which may be someone else's). `null` when there is
 * nothing to write: the person is staff (the hop and the switch action leave staff alone too),
 * or the API could not answer in time. Sign-in goes on either way, and the client layout
 * restores the account if the cookie is missing.
 *
 * The whole plan, including the token and the identity lookups before the API call, shares one
 * deadline, so sign-in never waits on it for longer than `RESTORE_TIMEOUT_MS`.
 */
export async function planSignInRestore(input: {
  sessionId: string;
}): Promise<SignInAccount | null> {
  return withDeadline(planWithoutDeadline(input.sessionId), RESTORE_TIMEOUT_MS);
}

/** Resolves to `null` if `work` has not settled in time; a late result is dropped. */
function withDeadline<T>(work: Promise<T | null>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn("Sign-in account restore timed out");
      resolve(null);
    }, ms);
  });
  // The work may fail after the deadline has passed; nobody is waiting for it then.
  work.catch(() => {});
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}

async function planWithoutDeadline(sessionId: string): Promise<SignInAccount | null> {
  const send = senderFor(sessionId);
  if (!(await isClientSession(send))) return null;
  // No candidate: a sign-in opens the profile's remembered account, whatever this browser held.
  const answer = await restoreAccountVia(send, null);
  if (!answer.ok) return null;
  return planRestoreHop({ next: CLIENT_ROUTES.home, restored: answer.restored }).switchTo ?? null;
}

/** Staff have no client accounts: nothing is restored or written for them. */
async function isClientSession(send: ApiSender): Promise<boolean> {
  try {
    const res = await send("/users/me", { method: "GET", cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { data?: unknown };
    const user = sessionUserSchema.safeParse(body.data);
    return user.success && usesBidAsClient(user.data);
  } catch {
    return false;
  }
}

/**
 * Sets the account on the sign-in redirect, so the person's first page is already in the right
 * account. When there is none to write (staff, the API failed or timed out) the browser's old
 * account cookie is removed, because a sign-in must never inherit the previous person's account;
 * the client layout then restores the right one. A staff member's "view as client" cookie is
 * left alone.
 */
export async function applySignInRestore(
  response: NextResponse,
  input: { sessionId: string; request: NextRequest },
): Promise<void> {
  const existing = readActingCookie(input.request.cookies.get(ACTING_LEGAL_ENTITY_COOKIE)?.value);
  if (existing?.viewSessionId) return;
  const account = await planSignInRestore({ sessionId: input.sessionId });
  if (!account) {
    response.cookies.delete(ACTING_LEGAL_ENTITY_COOKIE);
    return;
  }
  for (const { name, value, options } of cookiesForHop({
    redirect: CLIENT_ROUTES.home,
    switchTo: account,
  })) {
    response.cookies.set(name, value, options);
  }
}
