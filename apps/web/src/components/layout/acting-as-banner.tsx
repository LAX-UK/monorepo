import "server-only";

import {
  type ResolvedActingContext,
  resolveActingContext,
} from "@/lib/legal-entity/acting-context.server";
import { ActingAsTooltip } from "./acting-as-tooltip";
import { LegalEntitySwitcher } from "./legal-entity-switcher";

type Props = {
  /** From GET /users/me (`SessionUser.hasSeenActingContextTooltip`); when omitted, suppresses the hint.
   */
  hasSeenTooltip?: boolean;
  /** Session role — required for impersonation cookie resolution. */
  userRole?: string;
  className?: string;
  /** When set (e.g. dashboard layout), avoids a duplicate `/legal-entities/me` fetch. */
  prefetchedActingContext?: ResolvedActingContext;
};

/** Renders the acting-context switcher in the header chrome.
 * * Server component: resolves the membership list once per request and hands
 * the data to the client switcher, avoiding a client-side round trip.
 * * Returns `null` when the user has zero memberships (impossible
 * post-0027 backfill, but we never want to crash if it happens).
 */
export async function ActingAsBanner({
  hasSeenTooltip = true,
  userRole,
  className,
  prefetchedActingContext,
}: Props) {
  const { acting, memberships } = prefetchedActingContext ?? (await resolveActingContext(userRole));
  if (!acting) return null;

  const showTooltip = !hasSeenTooltip && memberships.some((m) => m.kind === "organisation");

  return (
    <div className={`relative inline-flex items-center gap-2 ${className ?? ""}`}>
      <LegalEntitySwitcher acting={acting} memberships={memberships} />
      <ActingAsTooltip initiallyVisible={showTooltip} />
    </div>
  );
}
