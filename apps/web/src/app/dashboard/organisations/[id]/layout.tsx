import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { EntityStatusBanner } from "@/components/dashboard/entity-status-banner";
import { initials } from "@/components/organisations/initials";
import {
  roleLabel,
  statusBadgeVariant,
  statusLabel,
  subkindLabel,
} from "@/components/organisations/labels";
import { OrgTabsNav } from "@/components/organisations/org-tabs-nav";
import { SetActingOrgButton } from "@/components/organisations/set-acting-org-button";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { LabelCaps } from "@auction/ui";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { notFound } from "next/navigation";

export default async function OrganisationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/organisations/${id}`,
  });
  const perOrgGw = createPerOrgGateway();
  const ctx = await perOrgGw.getContext(id);
  if (!ctx) {
    notFound();
  }

  const { member, entity } = ctx;
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);
  const isActing = acting?.id === id;

  return (
    <DashboardPage>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-outline-variant/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
              {initials(member.displayName)}
            </div>
            <div className="min-w-0 space-y-2">
              <LabelCaps>Organisation</LabelCaps>
              <h1 className="font-headline text-2xl font-semibold tracking-tight sm:text-3xl">
                {member.displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant={statusBadgeVariant(member.status)} size="sm">
                  {statusLabel(member.status)}
                </StatusBadge>
                <StatusBadge variant="neutral" size="sm">
                  {subkindLabel(member.subkind)}
                </StatusBadge>
                <StatusBadge variant="neutral" size="sm">
                  {roleLabel(member.role)}
                </StatusBadge>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {isActing ? (
              <StatusBadge variant="success" size="md">
                Active context
              </StatusBadge>
            ) : (
              <SetActingOrgButton legalEntityId={id} />
            )}
          </div>
        </header>

        {entity ? <EntityStatusBanner acting={{ ...member, status: entity.status }} /> : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-start">
          <OrgTabsNav orgId={id} className="lg:sticky lg:top-24" />
          <div className="min-w-0 space-y-6">{children}</div>
        </div>
      </div>
    </DashboardPage>
  );
}
