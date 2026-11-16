"use client";

import { detectActingEntityCookieDrift } from "@/lib/legal-entity/acting-entity-cookie-drift";
import {
  expireSharedActingCookie,
  setClientActingLegalEntityId,
} from "@/lib/legal-entity/client-acting-context";
import { useEffect } from "react";

type Props = {
  /** Acting entity id resolved server-side for this request (membership-validated). */
  serverActingId: string | null | undefined;
};

/** `?acting_debug=1` (or `true`) logs a reconciled cookie in production too. */
function actingDebugRequested(): boolean {
  const debug = new URLSearchParams(window.location.search).get("acting_debug");
  return debug === "1" || debug === "true";
}

const LOG_PREFIX = "[lax:acting-entity]";

/** Keeps the browser `lax_acting_legal_entity_id` cookie in sync with the
 * server-resolved acting entity on every navigation.
 *
 * The SSR self-heal in `resolveActingContext` cannot write cookies during a
 * Server Component render (Next.js swallows the mutation), so a stale cookie
 * from a previous account/org would otherwise persist and leak into client API
 * calls (e.g. `POST /bids` -> `not_a_member_of_legal_entity`). Rewriting it
 * here — where `document.cookie` writes are allowed — heals it for every
 * browser request. Impersonation cookies are left untouched (their session
 * payload must not be replaced with a plain UUID). */
export function ActingEntityCookieReconciler({ serverActingId }: Props) {
  useEffect(() => {
    // Before reading: a lingering shared copy would be reported as the cookie value.
    expireSharedActingCookie();
    // Effects only run in the browser, so the cookie is always there to read.
    const drift = detectActingEntityCookieDrift(serverActingId, document.cookie);
    // An aligned cookie needs nothing, and is not logged.
    if (!drift?.shouldReconcile) return;

    setClientActingLegalEntityId(drift.serverActingId);
    if (process.env.NODE_ENV !== "production" || actingDebugRequested()) {
      console.warn(`${LOG_PREFIX} reconciled stale acting cookie`, {
        from: drift.cookieActingId ?? "(absent)",
        to: drift.serverActingId,
      });
    }
  }, [serverActingId]);

  return null;
}
