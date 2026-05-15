import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardSection } from "@/components/dashboard/primitives/dashboard-section";
import { InvitationCardList } from "@/components/organisations/invitation-card-list";
import { subkindLabel } from "@/components/organisations/labels";
import { OrganisationCard } from "@/components/organisations/organisation-card";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { createPendingInvitationsGateway } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { SectionHeader } from "@auction/ui/components/section-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Building2 } from "lucide-react";
import Link from "next/link";

export default async function OrganisationsHubPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/organisations",
  });
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);

  const hubGw = createOrganisationHubGateway();
  const pendingGw = createPendingInvitationsGateway();

  const [memberships, pending] = await Promise.all([hubGw.listMemberships(), pendingGw.listMine()]);

  const orgs = memberships.filter((m) => m.kind === "organisation");
  const personal = memberships.find((m) => m.kind === "individual");

  const details = await Promise.all(
    orgs.map(async (o) => ({
      summary: o,
      detail: await hubGw.getEntityDetail(o.id),
    })),
  );

  return (
    <DashboardPage>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Organisations"
          meta={
            <span className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
              Workspace
            </span>
          }
          description="Manage organisations you belong to, respond to invitations, and continue setup."
          className="border-b border-outline-variant/20 pb-5"
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/onboarding/organisation?fresh=1" prefetch>
                Register organisation
              </Link>
            </Button>
          }
        />

        {pending.length > 0 ? (
          <Card className="mt-8">
            <CardHeader>
              <LabelCaps>Inbox</LabelCaps>
              <CardTitle className="font-headline text-xl tracking-tight">
                Pending invitations
              </CardTitle>
              <CardDescription>Accept or decline before they expire.</CardDescription>
            </CardHeader>
            <CardContent>
              <InvitationCardList invitations={pending} />
            </CardContent>
          </Card>
        ) : null}

        {personal ? (
          <DashboardSection
            className="mt-8"
            title="Personal account"
            description="Your individual profile used for bidding and receipts."
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-on-surface">{personal.displayName}</span>
              <StatusBadge variant="neutral" size="sm">
                {subkindLabel(personal.subkind)}
              </StatusBadge>
            </div>
          </DashboardSection>
        ) : null}

        {orgs.length === 0 ? (
          <div className="mt-8">
            <DashboardEmptyState
              icon={<Building2 className="size-6" aria-hidden />}
              title="No organisations yet"
              description="Register an organisation to sell as a gallery, dealer, or company. If you were invited, check your inbox first."
              action={
                <Button asChild variant="cta" size="sm">
                  <Link href="/onboarding/organisation?fresh=1" prefetch>
                    Register organisation
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-10 space-y-4">
            <SectionHeader
              kicker={<LabelCaps>Workspaces</LabelCaps>}
              heading={<DisplayHeading as="h2">Your organisations</DisplayHeading>}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/onboarding/organisation?fresh=1" prefetch>
                    Register organisation
                  </Link>
                </Button>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {details.map(({ summary, detail }) => (
                <OrganisationCard
                  key={summary.id}
                  summary={{
                    id: summary.id,
                    displayName: summary.displayName,
                    subkind: summary.subkind,
                    status: summary.status,
                    role: summary.role,
                    isPrimaryAdmin: summary.isPrimaryAdmin,
                  }}
                  detail={detail}
                  isActing={acting?.id === summary.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardPage>
  );
}
