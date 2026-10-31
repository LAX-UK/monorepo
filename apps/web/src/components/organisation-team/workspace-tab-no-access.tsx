import { getServerAccessRequests } from "@/lib/data/http/organisation-team.server";
import type { SectionTabAccess } from "@/lib/navigation/section-tabs";
import { askableRoles } from "@/lib/organisation-team/access-requests.vm";
import type { EntityActor } from "@auction/domain";
import { AccessDeniedState } from "@auction/ui/components/access-denied-state";
import { NoAccessActions } from "./ask-for-access-button";

type Props = {
  access: Extract<SectionTabAccess<string>, { kind: "forbidden" }>;
  legalEntityId: string;
  actor: EntityActor;
  userId: string;
};

/**
 * A tab of a workspace page (Team, Organisation) the person's role does not open, reached by its
 * address. It names the tab and who can open it, inside the page so the tabs they can use stay
 * in reach, and offers "Ask for access": a request to the owners and admins for a role that
 * opens it, or the request already waiting.
 */
export async function WorkspaceTabNoAccess({ access, legalEntityId, actor, userId }: Props) {
  const roles = actor.isImpersonation ? [] : askableRoles(actor.role, [access.capability]);
  const mine =
    roles.length > 0
      ? ((await getServerAccessRequests(legalEntityId, "pending").catch(() => null)) ?? [])
      : [];
  const waiting = mine.find((request) => request.requesterUserId === userId) ?? null;
  return (
    <AccessDeniedState
      size="panel"
      page={access.label}
      openedBy={access.openedBy}
      actions={
        <NoAccessActions
          legalEntityId={legalEntityId}
          page={access.label}
          roles={roles}
          waiting={waiting ? { id: waiting.id, role: waiting.requestedRole } : null}
        />
      }
    />
  );
}
