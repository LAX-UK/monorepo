import { SettingsSection } from "@/components/organisation-team/settings-section";
import { TwoStepPolicyPanel } from "@/components/organisation-team/two-step-policy-panel";
import { WorkspaceTabNoAccess } from "@/components/organisation-team/workspace-tab-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { requireOrganisationTab } from "@/lib/navigation/organisation-tabs";
import {
  loadTeamMembers,
  loadTeamScope,
  loadTwoStepPolicy,
} from "@/lib/organisation-team/team-data.server";
import { twoStepImpact } from "@/lib/organisation-team/two-step-impact";
import { entityActorCan } from "@auction/domain";
import { Notice } from "@auction/ui/lax";
import { notFound } from "next/navigation";

/**
 * The Security tab: the two-step policy and who has it on. Before requiring it, the owner sees
 * who is affected and what happens to each person.
 */
export default async function OrganisationSecurityPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: organisationHref("security"),
  });
  const scope = await loadTeamScope(user);
  if (!scope) notFound();
  const { acting, actor } = scope;
  const access = requireOrganisationTab(actor, "security");
  if (access.kind === "forbidden") {
    return (
      <WorkspaceTabNoAccess
        access={access}
        legalEntityId={acting.id}
        organisationName={acting.displayName}
        actor={actor}
        userId={user.id}
      />
    );
  }

  const [policy, members] = await Promise.all([loadTwoStepPolicy(scope), loadTeamMembers(scope)]);
  if (!policy) {
    return (
      <Notice tone="danger" alert title="We couldn't load the two-step policy.">
        Nothing has changed. Try again in a moment.
      </Notice>
    );
  }
  const people = members.ok
    ? members.data.map((m) => ({ userId: m.userId, name: m.user.name, role: m.role }))
    : [];
  const impact = twoStepImpact(
    people,
    Object.fromEntries(policy.members.map((m) => [m.userId, m.twoFactorEnabled])),
  );

  return (
    <div className="flex max-w-[960px] flex-col gap-8">
      <SettingsSection
        id="two-step-heading"
        title="Two-step verification"
        description={`Ask everyone who acts for ${acting.displayName} to use a second step when they sign in.`}
      >
        <TwoStepPolicyPanel
          legalEntityId={acting.id}
          organisationName={acting.displayName}
          required={policy.policy.required}
          impact={impact}
          canEdit={policy.canEdit}
          canRemind={entityActorCan(actor, "entity.security.remind")}
        />
      </SettingsSection>
    </div>
  );
}
