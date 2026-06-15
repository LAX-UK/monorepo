"use client";

import { detectActingEntityCookieDrift } from "@/lib/legal-entity/acting-entity-cookie-drift";
import { setClientActingLegalEntityId } from "@/lib/legal-entity/client-acting-context";
import { useEffect } from "react";

type Props = {
  /** Acting entity id resolved server-side for this request (membership-validated). */
  serverActingId: string | null | undefined;
  /** Log a snapshot even when the cookie already matches. */
  verbose?: boolean;
};

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
export function ActingEntityCookieReconciler({ serverActingId, verbose = false }: Props) {
  useEffect(() => {
    const drift = detectActingEntityCookieDrift(
      serverActingId,
      typeof document !== "undefined" ? document.cookie : null,
    );
    if (!drift) return;

    if (!drift.shouldReconcile) {
      if (verbose) {
        console.info(`${LOG_PREFIX} acting cookie aligned`, {
          serverActingId: drift.serverActingId,
          cookieActingId: drift.cookieActingId ?? "(absent)",
          isImpersonation: drift.isImpersonation,
        });
      }
      return;
    }

    setClientActingLegalEntityId(drift.serverActingId);
    if (verbose || process.env.NODE_ENV !== "production") {
      console.warn(`${LOG_PREFIX} reconciled stale acting cookie`, {
        from: drift.cookieActingId ?? "(absent)",
        to: drift.serverActingId,
      });
    }
  }, [serverActingId, verbose]);

  return null;
}
