import "server-only";

import { BID_API_AUDIENCE } from "@/lib/bff/config.server";
import { BidBffTokenService } from "@/lib/bff/token-service.server";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { deriveSsrOrigin } from "@/lib/data/http/server-request-headers";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { decodeActingContextCookie, isUuidString } from "@auction/types";
import type { NextRequest, NextResponse } from "next/server";
import { type HopPlan, planRestoreHop } from "./account-hops";
import { cookiesForHop } from "./acting-cookie.server";
import { ACTING_LEGAL_ENTITY_COOKIE } from "./client-acting-context";
import { type ApiSender, restoreAccountVia } from "./remembered-account.server";

/** Sign-in must not wait on this: past it, the layout restores the account on the first page. */
const RESTORE_TIMEOUT_MS = 3_000;

/**
 * Asks the API as `sessionId`. The session cookie is only on the response being built at sign-in,
 * so the request cannot be authenticated from cookies the way a page request is.
 */
function senderFor(sessionId: string): ApiSender {
  return async (path, init) => {
    const { token } = await new BidBffTokenService().resourceToken(
      sessionId,
      BID_API_AUDIENCE,
      "bid.read bid.write",
    );
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Origin", await deriveSsrOrigin());
    return fetch(`${getServerApiBase()}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(RESTORE_TIMEOUT_MS),
    });
  };
}

/** What this browser's account cookie says: the account it names, and whether it is a staff view. */
function readAccountCookie(value: string | undefined): {
  id: string | null;
  impersonating: boolean;
} {
  if (!value) return { id: null, impersonating: false };
  const decoded = decodeActingContextCookie(value);
  if (decoded) return { id: decoded.e, impersonating: Boolean(decoded.i?.sid) };
  return { id: isUuidString(value) ? value : null, impersonating: false };
}

/**
 * The account a person opens Bid as right after signing in, so the first page already has it and
 * the browser never needs the restore hop. `null` when there is nothing to write: the cookie
 * belongs to a staff member viewing as a client (a restore would end that), or the API could not
 * answer. Sign-in goes on either way, and the client layout restores the account if the cookie
 * is still missing.
 *
 * @param actingCookie this browser's account cookie, if it has one (it survives sign-out).
 */
export async function planSignInRestore(input: {
  sessionId: string;
  actingCookie: string | undefined;
}): Promise<HopPlan | null> {
  const cookie = readAccountCookie(input.actingCookie);
  if (cookie.impersonating) return null;
  const answer = await restoreAccountVia(senderFor(input.sessionId), cookie.id);
  if (!answer.ok) return null;
  return planRestoreHop({ next: CLIENT_ROUTES.home, restored: answer.restored });
}

/**
 * Writes the restored account on the sign-in redirect, so the person's first page is already in
 * the right account. Writes nothing when `planSignInRestore` has nothing to say.
 */
export async function applySignInRestore(
  response: NextResponse,
  input: { sessionId: string; request: NextRequest },
): Promise<void> {
  const plan = await planSignInRestore({
    sessionId: input.sessionId,
    actingCookie: input.request.cookies.get(ACTING_LEGAL_ENTITY_COOKIE)?.value,
  });
  if (!plan) return;
  for (const { name, value, options } of cookiesForHop(plan)) {
    response.cookies.set(name, value, options);
  }
}
