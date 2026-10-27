import { OrgTabSectionHeader } from "@/components/organisations/org-tab-section-header";
import { TwoFactorPolicyCard } from "@/components/security/two-factor-policy-card";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerOrgTwoFactorPolicy } from "@/lib/data/http/two-factor-policy.server";
import { requireActiveOrganisationId } from "@/lib/legal-entity/active-organisation.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { entityRoleCan } from "@auction/domain";
import { DisplayHeading } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { SectionHeader } from "@auction/ui/components/section-header";
import { notFound } from "next/navigation";

export default async function OrganisationSecurityPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: organisationHref("security"),
  });
  const id = await requireActiveOrganisationId(user);
  const ctx = await createPerOrgGateway().getContext(id);
  if (!ctx) notFound();

  const canRead = entityRoleCan(ctx.member.role, "entity.security.read");
  // The API refuses the policy to everyone but owners and admins, so asking would only fail.
  const policy = canRead ? await getServerOrgTwoFactorPolicy(id) : null;

  return (
    <div className="space-y-6">
      <OrgTabSectionHeader>
        <SectionHeader heading={<DisplayHeading as="h2">Two-step policy</DisplayHeading>} />
      </OrgTabSectionHeader>

      {policy ? (
        <TwoFactorPolicyCard
          scope={{ kind: "org", legalEntityId: id }}
          required={policy.policy.required}
          members={policy.coverage.members}
          enrolled={policy.coverage.enrolled}
          canEdit={policy.canEdit}
        />
      ) : (
        <Alert>
          <AlertTitle>{canRead ? "Policy unavailable" : "Owners and admins only"}</AlertTitle>
          <AlertDescription>
            {canRead
              ? "We could not load this organisation's two-step policy. Try again in a moment."
              : "Only owners and admins can see whether this organisation requires two-step verification."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
