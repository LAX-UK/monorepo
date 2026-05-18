import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { EntityStatusBanner } from "@/components/dashboard/entity-status-banner";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
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
        <DashboardDetailHeader
          sticky
          backHref="/dashboard/organisations"
          backLabel="Organisations"
          eyebrow="Organisation"
          title={member.displayName}
          badges={
            <>
              <StatusBadge variant={statusBadgeVariant(member.status)} size="sm">
                {statusLabel(member.status)}
              </StatusBadge>
              <StatusBadge variant="neutral" size="sm">
                {subkindLabel(member.subkind)}
              </StatusBadge>
              <StatusBadge variant="neutral" size="sm">
                {roleLabel(member.role)}
              </StatusBadge>
            </>
          }
          actions={
            isActing ? (
              <StatusBadge variant="success" size="md">
                Active context
              </StatusBadge>
            ) : (
              <SetActingOrgButton legalEntityId={id} />
            )
          }
        />

        {entity ? <EntityStatusBanner acting={{ ...member, status: entity.status }} /> : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-start">
          <OrgTabsNav orgId={id} className="lg:sticky lg:top-24" />
          <div className="min-w-0 space-y-6">{children}</div>
        </div>
      </div>
    </DashboardPage>
  );
}
