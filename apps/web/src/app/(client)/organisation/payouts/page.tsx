import { ConnectLoadFailure } from "@/components/connect/connect-load-failure";
import { ConnectWorkspace } from "@/components/connect/connect-workspace";
import { PayoutSetupSteps } from "@/components/connect/payout-setup-steps";
import { OrgTabSectionHeader } from "@/components/organisations/org-tab-section-header";
import { OrganisationTabNoAccess } from "@/components/organisations/organisation-tab-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  getServerStripeConnectClientConfig,
  syncServerStripeConnectStatus,
} from "@/lib/data/http/stripe-connect.server";
import { requireActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { requireOrganisationTab } from "@/lib/navigation/organisation-tabs";
import { payoutSetupSteps } from "@/lib/presenters/payout-setup-steps";
import { DisplayHeading } from "@auction/ui";
import { SectionHeader } from "@auction/ui/components/section-header";
import { notFound } from "next/navigation";

export default async function OrganisationPayoutsPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: organisationHref("payouts"),
  });
  const { organisation, actor } = await requireActiveOrganisationActor(user);
  const access = requireOrganisationTab(actor, "payouts");
  if (access.kind === "forbidden") return <OrganisationTabNoAccess access={access} />;
  const id = organisation.id;
  const ctx = await createPerOrgGateway().getContext(id);
  if (!ctx) notFound();
  const { member, entity } = ctx;

  const [clientConfig, connectRes] = await Promise.all([
    getServerStripeConnectClientConfig(),
    syncServerStripeConnectStatus(id),
  ]);

  const connectFailure =
    connectRes.ok || connectRes.error === "not_connected" ? null : connectRes.error;

  return (
    <div className="space-y-6">
      <OrgTabSectionHeader>
        <SectionHeader heading={<DisplayHeading as="h2">Payout setup</DisplayHeading>} />
      </OrgTabSectionHeader>
      {connectFailure ? (
        <ConnectLoadFailure error={connectFailure} />
      ) : (
        <>
          <p className="font-body text-sm text-on-surface-variant">
            Two steps, both on this page, so {member.displayName} can be paid when its works sell.
          </p>
          <PayoutSetupSteps
            steps={payoutSetupSteps("organisation", {
              identityChecked: false,
              payoutsReady: connectRes.ok ? connectRes.data.payoutsEnabled : false,
            })}
          />
          <ConnectWorkspace
            publishableKey={clientConfig.publishableKey}
            connectEnforced={clientConfig.connectEnforced}
            status={connectRes.ok ? connectRes.data : null}
            syncDegraded={connectRes.ok ? Boolean(connectRes.data.syncDegraded) : false}
            legalEntityId={id}
            memberRole={member.role}
            entityStatus={entity?.status ?? member.status}
            kycApproved
            isLaxManaged={entity?.isLaxManaged ?? false}
            returnPath={organisationHref("payouts")}
            showDashboardLink={false}
          />
        </>
      )}
    </div>
  );
}
