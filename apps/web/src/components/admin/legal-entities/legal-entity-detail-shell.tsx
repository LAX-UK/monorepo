import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailTabNav,
} from "@/components/admin/catalog";
import { LegalEntitySupportActionsSection } from "@/components/admin/legal-entities/legal-entity-detail-context-rail";
import { LegalEntityImpersonationButton } from "@/components/admin/legal-entities/legal-entity-impersonation-button";
import { buildLegalEntityDetailTabSpecs } from "@/lib/admin/catalog/detail-tab-compat";
import { formatLegalEntityKindSubkind } from "@/lib/admin/legal-entity-list-presenter";
import type { AdminLegalEntityDetailBundle } from "@/lib/admin/load-admin-legal-entity-detail";
import { relativeFromIso } from "@/lib/admin/relative-time";
import { stripeRequirementsAttentionCountForEntity } from "@/lib/admin/stripe-connect-staff-presenter";
import { formatDateTime } from "@/lib/ui/format";
import type { ReactNode } from "react";

type Props = {
  bundle: AdminLegalEntityDetailBundle;
  backHref: string;
  error?: string | null;
  success?: string | null;
  saleCount?: number;
  children: ReactNode;
};

export function LegalEntityDetailShell({
  bundle,
  backHref,
  error,
  success,
  saleCount = 0,
  children,
}: Props) {
  const { entity, documents } = bundle;
  const pendingDocCount = documents.filter((d) => d.reviewStatus === "pending").length;
  const stripeDueCount = stripeRequirementsAttentionCountForEntity(entity);
  const tabSpecs = buildLegalEntityDetailTabSpecs({
    entityId: entity.id,
    pendingDocCount,
    stripeDueCount,
    saleCount,
  });

  const statusBadge = <AdminStatusBadge domain="legalEntity" status={entity.status} size="md" />;

  const quickLinks = [
    { label: "Onboarding issues", href: "/admin/onboarding-issues?tab=entities" },
    ...(stripeDueCount > 0
      ? [{ label: "Stripe tab", href: `/admin/legal-entities/${entity.id}/stripe` }]
      : []),
  ];

  return (
    <CatalogDetailShell
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Legal entities", href: backHref }, { label: entity.displayName }]}
        />
      }
      eyebrow="Legal entity"
      title={entity.displayName}
      description={`${formatLegalEntityKindSubkind(entity.kind, entity.subkind)} · Created ${formatDateTime(entity.createdAt)}`}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge}
          <span className="font-body text-xs text-on-surface-variant">
            Updated {formatDateTime(entity.updatedAt)} (
            {relativeFromIso(entity.updatedAt.toISOString())})
          </span>
        </div>
      }
      metaBelowTitle
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AdminPinPageButton label={entity.displayName} />
          <LegalEntityImpersonationButton
            legalEntityId={entity.id}
            displayName={entity.displayName}
          />
        </div>
      }
      mobileMeta={
        <CatalogDetailMobileMeta
          entityId={entity.id}
          updatedAt={entity.updatedAt}
          status={statusBadge}
          quickLinks={quickLinks}
        />
      }
      stickySubnav={
        <CatalogDetailTabNav
          tabs={tabSpecs}
          entityKind="legal-entity"
          aria-label="Legal entity sections"
        />
      }
    >
      {success ? (
        <AdminListAlert title="Done" variant="default">
          {success}
        </AdminListAlert>
      ) : null}
      {error ? <AdminListAlert title="Could not apply change">{error}</AdminListAlert> : null}
      <LegalEntitySupportActionsSection entity={entity} hideImpersonation />
      {children}
    </CatalogDetailShell>
  );
}
