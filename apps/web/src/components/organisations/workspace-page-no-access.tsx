import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SwitchAccountAction } from "@/components/layout/account-switcher/switch-account-action";
import { NoAccessActions } from "@/components/organisation-team/ask-for-access-button";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { type AccessAsk, loadAccessAsk } from "@/lib/organisation-team/access-ask.server";
import { workspaceAccessReason } from "@/lib/presenters/workspace-access/access-reason";
import { workspacePageAt } from "@/lib/presenters/workspace-access/workspace-access";
import { AccessDeniedState } from "@auction/ui/components/access-denied-state";

type Props = {
  /** The page's name: "You don't have access to Bids". */
  label: string;
  /** Who can open it, from the capability table: "Owners, admins and buyer agents". */
  openedBy: string | null;
  /** The page's own address, so switching account lands back on it. */
  next: string;
  /** Leave out the page column when the caller already renders inside one. */
  inPage?: boolean;
};

/**
 * A workspace page the member's role does not open, reached by its address. It names the page,
 * who can open it and what the role can do instead, and offers the way on: "Ask for access" (or
 * the request already sent, which can be withdrawn), Back to Home and Switch account, with the
 * owner to ask under them.
 */
export async function WorkspacePageNoAccess({ label, openedBy, next, inPage = false }: Props) {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: next });
  const active = await resolveActiveOrganisationActor(user);
  const ask: AccessAsk | null = active
    ? await loadAccessAsk({
        legalEntityId: active.organisation.id,
        actor: active.actor,
        userId: user.id,
        capabilities: workspacePageAt(next)?.anyCapability ?? [],
      })
    : null;
  const reason = active
    ? workspaceAccessReason({
        page: label,
        organisationName: active.organisation.displayName,
        openedBy,
        role: active.actor.role,
      })
    : null;
  const state = (
    <AccessDeniedState
      page={label}
      openedBy={openedBy}
      {...(reason ? { reason } : {})}
      footnote={ask?.footnote ?? null}
      actions={
        <>
          <NoAccessActions
            legalEntityId={ask?.legalEntityId ?? ""}
            page={label}
            roles={ask?.roles ?? []}
            waiting={ask?.waiting ?? null}
          />
          <SwitchAccountAction destination={next} emphasis="secondary" />
        </>
      }
    />
  );
  return inPage ? state : <DashboardPage>{state}</DashboardPage>;
}
