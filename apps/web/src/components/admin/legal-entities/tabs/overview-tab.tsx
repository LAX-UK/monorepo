import { AdminStaffLabeledField } from "@/components/admin/admin-staff-labeled-field";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import {
  CatalogDetailTabCard,
  CatalogDetailTabPanel,
  DetailAttentionTable,
  DetailBoardKpiStrip,
  DetailEntityTable,
} from "@/components/admin/catalog";
import {
  DetailActivityPreviewSection,
  DetailStatValue,
} from "@/components/admin/catalog/detail-board";
import { LegalEntityHealthPanel } from "@/components/admin/legal-entities/legal-entity-health-panel";
import { formatLegalEntityKindSubkind } from "@/lib/admin/legal-entity-list-presenter";
import type { AdminLegalEntityDetailBundle } from "@/lib/admin/load-admin-legal-entity-detail";
import { presentStripeConnectAccount } from "@/lib/admin/stripe-connect-staff-presenter";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildLegalEntityOverviewViewModel } from "@/lib/data/view-models/legal-entity-overview.vm";
import { formatDateTime } from "@/lib/ui/format";
import Link from "next/link";

type Props = {
  entity: AdminLegalEntityDetailBundle["entity"];
  creator: AdminLegalEntityDetailBundle["creator"];
  health: AdminLegalEntityDetailBundle["health"];
  pendingDocCount?: number;
  activityEvents?: readonly AdminDomainEventRow[];
  canViewActivity?: boolean;
};

export function LegalEntityOverviewTab({
  entity,
  creator,
  health,
  pendingDocCount = 0,
  activityEvents = [],
  canViewActivity = false,
}: Props) {
  const vm = buildLegalEntityOverviewViewModel({ entity, health, pendingDocCount });
  const stripeAccount = presentStripeConnectAccount(entity.stripeConnectAccountId);

  const businessRows = [
    { id: "legal-name", label: "Legal name", value: entity.legalName ?? "—" },
    {
      id: "kind",
      label: "Kind",
      value: formatLegalEntityKindSubkind(entity.kind, entity.subkind),
    },
    {
      id: "created",
      label: "Created",
      value: formatDateTime(entity.createdAt),
    },
    {
      id: "updated",
      label: "Updated",
      value: formatDateTime(entity.updatedAt),
    },
    {
      id: "stripe",
      label: "Stripe Connect",
      value: stripeAccount?.primary ?? "—",
    },
    {
      id: "payouts",
      label: "Payouts",
      value: entity.stripeConnectPayoutsEnabled ? "Enabled" : "Not enabled",
    },
  ];

  return (
    <CatalogDetailTabPanel framed={false}>
      <div className="space-y-6">
        <DetailBoardKpiStrip
          ariaLabel="Legal entity summary"
          tiles={vm.kpiTiles}
          className="mb-0"
        />

        {vm.blockerRows.length > 0 ? <DetailAttentionTable rows={vm.blockerRows} /> : null}

        <LegalEntityHealthPanel health={health} />

        <CatalogDetailTabCard title="Business summary" description="Core business information.">
          <DetailEntityTable
            rows={businessRows}
            getRowId={(row) => row.id}
            emptyTitle="No business details"
            columns={[
              {
                id: "field",
                header: "Field",
                cell: (row) => <span className="text-on-surface-variant">{row.label}</span>,
              },
              {
                id: "value",
                header: "Value",
                cell: (row) => <DetailStatValue row={row} />,
              },
            ]}
          />
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-on-surface-variant">Created by</dt>
              <dd className="text-on-surface">
                {creator ? (
                  <Link
                    href={`/admin/clients/${creator.id}`}
                    className="text-link underline-offset-2 hover:underline"
                  >
                    {creator.name}
                  </Link>
                ) : (
                  "—"
                )}
                {creator?.email ? (
                  <span className="mt-0.5 block text-xs text-on-surface-variant">
                    {creator.email}
                  </span>
                ) : null}
              </dd>
            </div>
            {stripeAccount ? (
              <div className="space-y-1">
                <dt className="text-on-surface-variant">Stripe account</dt>
                <dd className="text-on-surface">
                  <AdminStaffLabeledField
                    primary={stripeAccount.primary}
                    secondary={
                      entity.stripeConnectPayoutsEnabled
                        ? "Payouts enabled"
                        : "Payout setup in progress"
                    }
                  />
                </dd>
              </div>
            ) : null}
          </div>
        </CatalogDetailTabCard>

        {canViewActivity ? (
          <DetailActivityPreviewSection
            title="Recent activity"
            description="Lifecycle, Stripe Connect, and membership events."
            events={activityEvents}
            exportFilters={{ aggregateType: "legal_entity", aggregateId: entity.id }}
            emptyMessage="No activity recorded for this organisation yet."
            viewAllHref={`/admin/legal-entities/${entity.id}/activity`}
          />
        ) : null}

        <AdminTechnicalIdDisclosure
          items={[{ label: "Legal entity ID", value: entity.id, copyLabel: "Legal entity ID" }]}
        />
      </div>
    </CatalogDetailTabPanel>
  );
}
