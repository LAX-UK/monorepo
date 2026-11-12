import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { InvitationList } from "@/components/organisations/invitation-list";
import { OrgModuleComingSoon } from "@/components/organisations/org-module-coming-soon";
import { ListEmpty, ListLoadError } from "@/components/workspace/list-states";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_EMPTY, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { invitationRows } from "@/lib/organisations/organisation-accounts.vm";
import { ButtonLink } from "@auction/ui/lax/button-link";
import Link from "next/link";

export default async function InvitationsInboxPage() {
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  if (!orgModuleEnabled) {
    return (
      <DashboardListPage title="Invitations">
        <OrgModuleComingSoon />
      </DashboardListPage>
    );
  }

  await requireAuthenticatedUser({
    shell: "client",
    loginNext: DASHBOARD_ROUTES.invitations,
  });

  let failed = false;
  let pending: PendingInvitationRow[] = [];

  try {
    const res = await authedServerFetch("/legal-entities/invitations/mine", { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { data: PendingInvitationRow[] };
      pending = body.data ?? [];
    } else {
      failed = true;
    }
  } catch {
    failed = true;
  }

  const back = (
    <ButtonLink variant="secondary" Link={Link} href={DASHBOARD_ROUTES.organisations} prefetch>
      Your organisations
    </ButtonLink>
  );

  return (
    <DashboardListPage
      title="Invitations"
      description="Invitations to join an organisation, sent to your account email."
      actions={back}
    >
      {failed ? <ListLoadError /> : null}
      {!failed && pending.length === 0 ? (
        <ListEmpty
          illustration="plinth"
          title={DASHBOARD_EMPTY.invitations.title}
          description={DASHBOARD_EMPTY.invitations.description}
        />
      ) : null}
      {!failed && pending.length > 0 ? <InvitationList rows={invitationRows(pending)} /> : null}
    </DashboardListPage>
  );
}
