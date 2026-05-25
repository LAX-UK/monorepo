import "server-only";

import {
  type ResolvedActingContext,
  resolveActingContext,
} from "@/lib/legal-entity/acting-context.server";
import type { LegalEntitySummary } from "@auction/types";
import { ActingAsTooltip } from "./acting-as-tooltip";
import { LegalEntitySwitcher } from "./legal-entity-switcher";

function personalOnlyContext(
  acting: LegalEntitySummary,
  memberships: LegalEntitySummary[],
): { acting: LegalEntitySummary; memberships: LegalEntitySummary[] } {
  const personalMemberships = memberships.filter((m) => m.kind === "individual");
  const personal =
    personalMemberships.find((m) => m.id === acting.id) ??
    personalMemberships[0] ??
    (acting.kind === "individual" ? acting : null);
  if (!personal) {
    return { acting, memberships: personalMemberships };
  }
  return {
    acting: personal,
    memberships: personalMemberships.length > 0 ? personalMemberships : [personal],
  };
}

type Props = {
  /** From GET /users/me (`SessionUser.hasSeenActingContextTooltip`); when omitted, suppresses the hint.
   */
  hasSeenTooltip?: boolean;
  /** Session role — required for impersonation cookie resolution. */
  userRole?: string;
  userStaffRole?: string | null;
  className?: string;
  /** When set (e.g. dashboard layout), avoids a duplicate `/legal-entities/me` fetch. */
  prefetchedActingContext?: ResolvedActingContext;
  /** Pending org invites for the user's email (switcher badge). */
  pendingInvitesCount?: number;
  /** When false (production), hide organisation workspaces in the switcher. */
  orgModuleEnabled?: boolean;
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
  userStaffRole,
  className,
  prefetchedActingContext,
  pendingInvitesCount = 0,
  orgModuleEnabled = true,
}: Props) {
  const { acting, memberships } =
    prefetchedActingContext ?? (await resolveActingContext(userRole, userStaffRole ?? null));
  if (!acting) return null;

  const switcherContext = orgModuleEnabled
    ? { acting, memberships }
    : personalOnlyContext(acting, memberships);

  const showTooltip =
    orgModuleEnabled && !hasSeenTooltip && memberships.some((m) => m.kind === "organisation");

  return (
    <div className={`relative inline-flex items-center gap-2 ${className ?? ""}`}>
      <LegalEntitySwitcher
        acting={switcherContext.acting}
        memberships={switcherContext.memberships}
        pendingInvitesCount={pendingInvitesCount}
        orgModuleEnabled={orgModuleEnabled}
      />
      <ActingAsTooltip initiallyVisible={showTooltip} />
    </div>
  );
}
