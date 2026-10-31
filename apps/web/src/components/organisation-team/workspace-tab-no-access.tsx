import type { SectionTabAccess } from "@/lib/navigation/section-tabs";
import { loadAccessAsk } from "@/lib/organisation-team/access-ask.server";
import { workspaceAccessReason } from "@/lib/presenters/workspace-access/access-reason";
import type { EntityActor } from "@auction/domain";
import { AccessDeniedState } from "@auction/ui/components/access-denied-state";
import { NoAccessActions } from "./ask-for-access-button";

type Props = {
  access: Extract<SectionTabAccess<string>, { kind: "forbidden" }>;
  legalEntityId: string;
  organisationName: string;
  actor: EntityActor;
  userId: string;
};

/**
 * A tab of a workspace page (Team, Organisation) the person's role does not open, reached by its
 * address. It names the tab, who can open it and what the role can do instead, inside the page so
 * the tabs they can use stay in reach, and offers "Ask for access" (or the request already
 * waiting) and the owner to ask.
 */
export async function WorkspaceTabNoAccess({
  access,
  legalEntityId,
  organisationName,
  actor,
  userId,
}: Props) {
  const ask = await loadAccessAsk({
    legalEntityId,
    actor,
    userId,
    capabilities: [access.capability],
  });
  const reason = workspaceAccessReason({
    page: access.label,
    organisationName,
    openedBy: access.openedBy,
    role: actor.role,
  });
  return (
    <AccessDeniedState
      size="panel"
      page={access.label}
      openedBy={access.openedBy}
      {...(reason ? { reason } : {})}
      footnote={ask.footnote}
      actions={
        <NoAccessActions
          legalEntityId={legalEntityId}
          page={access.label}
          roles={ask.roles}
          waiting={ask.waiting}
          currentRole={actor.role}
        />
      }
    />
  );
}
