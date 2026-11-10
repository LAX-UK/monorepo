import "server-only";

import { usesBidAsClient } from "@/lib/auth/client-audience";
import { fetchBidApiAsSession } from "@/lib/bff/bid-api-session.server";
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
      const origin = await deriveSsrOrigin();
      const { response: res } = await fetchBidApiAsSession({
        sessionId,
        scopes: "bid.read bid.write",
        input: `${getServerApiBase()}${path}`,
        init: (token) => {
          const headers = new Headers(init.headers);
          headers.set("Authorization", `Bearer ${token}`);
          headers.set("Origin", origin);
          return { ...init, headers, signal: AbortSignal.timeout(RESTORE_TIMEOUT_MS) };
        },
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

/** What a sign-in decided: staff are left as they are; a client opens in an account. */
export type SignInRestore = { kind: "staff" } | { kind: "client"; account: SignInAccount };

/**
 * The account a person opens Bid as right after signing in, so the first page already has it and
 * the browser never needs the restore hop. For a client it is the account their profile remembers
 * on any device (never this browser's old cookie, which may be someone else's). A staff member
 * has no client accounts, so nothing is restored for them (the hop and the switch action leave
 * staff alone too). `null` when it is not known: the API could not answer in time. Sign-in goes on
 * either way, and the client layout restores the account if the cookie is missing.
 *
 * The whole plan, including the token and the identity lookups before the API call, shares one
 * deadline, so sign-in never waits on it for longer than `RESTORE_TIMEOUT_MS`.
 */
export async function planSignInRestore(input: {
  sessionId: string;
}): Promise<SignInRestore | null> {
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

async function planWithoutDeadline(sessionId: string): Promise<SignInRestore | null> {
  const send = senderFor(sessionId);
  const who = await whoSignedIn(send);
  if (who !== "client") return who === "staff" ? { kind: "staff" } : null;
  // No candidate: a sign-in opens the profile's remembered account, whatever this browser held.
  const answer = await restoreAccountVia(send, null);
  if (!answer.ok) return null;
  const account = planRestoreHop({ next: CLIENT_ROUTES.home, restored: answer.restored }).switchTo;
  return account ? { kind: "client", account } : null;
}

/** Whether the new session is a client or staff; `unknown` when the API could not say. */
async function whoSignedIn(send: ApiSender): Promise<"client" | "staff" | "unknown"> {
  try {
    const res = await send("/users/me", { method: "GET", cache: "no-store" });
    if (!res.ok) return "unknown";
    const body = (await res.json()) as { data?: unknown };
    const user = sessionUserSchema.safeParse(body.data);
    if (!user.success) return "unknown";
    return usesBidAsClient(user.data) ? "client" : "staff";
  } catch {
    return "unknown";
  }
}

/**
 * Sets the account on the sign-in redirect, so the person's first page is already in the right
 * account. A sign-in must never inherit the previous person's account, so a client's browser has
 * its old account cookie replaced (or removed when nothing could be written; the client layout
 * then restores the right one). That includes a staff "view as client" cookie left on a shared
 * browser: it is kept only when the new session is staff.
 */
export async function applySignInRestore(
  response: NextResponse,
  input: { sessionId: string; request: NextRequest },
): Promise<void> {
  const plan = await planSignInRestore({ sessionId: input.sessionId });
  if (plan?.kind === "staff") {
    // Staff have no account to write; their own view-as cookie, if any, stays.
    const existing = readActingCookie(input.request.cookies.get(ACTING_LEGAL_ENTITY_COOKIE)?.value);
    if (!existing?.viewSessionId) response.cookies.delete(ACTING_LEGAL_ENTITY_COOKIE);
    return;
  }
  if (plan?.kind !== "client") {
    response.cookies.delete(ACTING_LEGAL_ENTITY_COOKIE);
    return;
  }
  for (const { name, value, options } of cookiesForHop({
    redirect: CLIENT_ROUTES.home,
    switchTo: plan.account,
  })) {
    response.cookies.set(name, value, options);
  }
}
