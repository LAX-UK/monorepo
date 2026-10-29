import { OrgTabSectionHeader } from "@/components/organisations/org-tab-section-header";
import { OrganisationTabNoAccess } from "@/components/organisations/organisation-tab-no-access";
import { TwoFactorPolicyCard } from "@/components/security/two-factor-policy-card";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerOrgTwoFactorPolicy } from "@/lib/data/http/two-factor-policy.server";
import { requireActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { requireOrganisationTab } from "@/lib/navigation/organisation-tabs";
import { DisplayHeading } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { SectionHeader } from "@auction/ui/components/section-header";
import { notFound } from "next/navigation";

export default async function OrganisationSecurityPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: organisationHref("security"),
  });
  const { organisation, actor } = await requireActiveOrganisationActor(user);
  const access = requireOrganisationTab(actor, "security");
  if (access.kind === "forbidden") return <OrganisationTabNoAccess access={access} />;
  const id = organisation.id;
  const ctx = await createPerOrgGateway().getContext(id);
  if (!ctx) notFound();

  const policy = await getServerOrgTwoFactorPolicy(id);

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
          <AlertTitle>Policy unavailable</AlertTitle>
          <AlertDescription>
            We could not load this organisation&apos;s two-step policy. Try again in a moment.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
