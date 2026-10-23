import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { EntityStatusBanner } from "@/components/dashboard/entity-status-banner";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import {
  roleLabel,
  statusBadgeVariant,
  statusLabel,
  subkindLabel,
} from "@/components/organisations/labels";
import { SetActingOrgButton } from "@/components/organisations/set-acting-org-button";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { notFound, redirect } from "next/navigation";

/** Pills read as words here, so they opt out of the badge's capitals. */
const TAG_CASE = "normal-case tracking-normal";

export default async function OrganisationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  if (!orgModuleEnabled) {
    redirect("/dashboard/organisations");
  }

  const { id } = await params;
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/seller/organisations/${id}`,
  });
  const perOrgGw = createPerOrgGateway();
  const access = await perOrgGw.resolveAccess(id);
  if (access.kind === "not_found") {
    notFound();
  }
  if (access.kind === "forbidden") {
    return (
      <DashboardPage>
        <div className="mx-auto max-w-5xl space-y-6">
          <DashboardDetailHeader
            compactOnMobile
            backHref="/dashboard/seller"
            backLabel="Selling"
            title="Organisation"
          />
          <DashboardSliceErrorAlert failure={access.failure} />
        </div>
      </DashboardPage>
    );
  }

  const { member, entity } = access.context;
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);
  const isActing = acting?.id === id;

  return (
    <DashboardPage>
      <div className="mx-auto max-w-5xl space-y-6">
        <DashboardDetailHeader
          compactOnMobile
          backHref="/dashboard/seller"
          backLabel="Selling"
          title={member.displayName}
          badges={
            <>
              <StatusBadge
                variant={statusBadgeVariant(member.status)}
                size="sm"
                className={TAG_CASE}
              >
                {statusLabel(member.status)}
              </StatusBadge>
              <StatusBadge variant="neutral" size="sm" className={TAG_CASE}>
                {subkindLabel(member.subkind)}
              </StatusBadge>
              <StatusBadge variant="neutral" size="sm" className={TAG_CASE}>
                {roleLabel(member.role)}
              </StatusBadge>
            </>
          }
          // The Selling header already says which organisation is active, so only the way to
          // switch to it is offered here.
          actions={isActing ? undefined : <SetActingOrgButton legalEntityId={id} />}
        />

        {entity ? <EntityStatusBanner acting={{ ...member, status: entity.status }} /> : null}

        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </DashboardPage>
  );
}
