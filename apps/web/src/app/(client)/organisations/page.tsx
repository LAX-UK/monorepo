import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { OrgSubmittedAlert } from "@/components/dashboard/org-submitted-alert";
import { AccountList } from "@/components/organisations/account-list";
import { InvitationList } from "@/components/organisations/invitation-list";
import { OrgModuleComingSoon } from "@/components/organisations/org-module-coming-soon";
import { ListSection } from "@/components/workspace/list-section";
import { ListEmpty, ListLoadError } from "@/components/workspace/list-states";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { REGISTER_ORGANISATION_HREF } from "@/lib/navigation/account-switcher-model";
import { accountRows, invitationRows } from "@/lib/organisations/organisation-accounts.vm";
import { loadOrganisationsHub } from "@/lib/organisations/organisations-hub.server";
import { ButtonLink } from "@auction/ui/lax/button-link";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Your organisations" };

function RegisterOrganisation() {
  return (
    <ButtonLink variant="primary" Link={Link} href={REGISTER_ORGANISATION_HREF} prefetch>
      Register an organisation
    </ButtonLink>
  );
}

/**
 * Every account the person can use Bid as, with the invitations waiting for an answer. It is
 * reached from the account switcher's "All accounts"; Register an organisation is the page's one
 * action, in the header, or in the empty state while there is no organisation yet.
 */
export default async function OrganisationsHubPage() {
  if (!(await resolveOrgModuleEnabledFromRequest())) {
    return (
      <DashboardListPage title="Organisations">
        <OrgModuleComingSoon />
      </DashboardListPage>
    );
  }

  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/organisations" });
  const [{ acting }, hub] = await Promise.all([
    resolveActingContext(user.role, user.staffRoles),
    loadOrganisationsHub(),
  ]);

  const common = {
    title: "Your organisations",
    description: "Open an account, answer an invitation or register an organisation.",
    banner: <OrgSubmittedAlert />,
  };
  if (!hub.ok) {
    return (
      <DashboardListPage {...common}>
        <ListLoadError />
      </DashboardListPage>
    );
  }

  const accounts = accountRows({
    personal: hub.personal,
    organisations: hub.organisations,
    actingId: acting?.id ?? null,
  });
  const invitations = invitationRows(hub.invitations);
  const hasOrganisations = hub.organisations.length > 0;

  return (
    <DashboardListPage
      {...common}
      {...(hasOrganisations ? { actions: <RegisterOrganisation /> } : {})}
    >
      {invitations.length > 0 ? (
        <ListSection
          id="pending-invitations"
          title="Pending invitations"
          count={invitations.length}
          description="Accept or decline before they expire."
          className="mt-0"
        >
          <InvitationList rows={invitations} />
        </ListSection>
      ) : null}
      <ListSection
        id="your-accounts"
        title="Your accounts"
        count={accounts.length}
        {...(invitations.length > 0 ? {} : { className: "mt-0" })}
      >
        <AccountList rows={accounts} />
      </ListSection>
      {hasOrganisations ? null : (
        <ListEmpty
          illustration="plinth"
          title="No organisations yet"
          description="Register an organisation to sell as a team, or accept an invitation to join one."
          actions={<RegisterOrganisation />}
        />
      )}
    </DashboardListPage>
  );
}
