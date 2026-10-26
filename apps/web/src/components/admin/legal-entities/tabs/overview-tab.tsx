"use client";

import { AdminStaffLabeledField } from "@/components/admin/admin-staff-labeled-field";
import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { LegalEntityHealthPanel } from "@/components/admin/legal-entities/legal-entity-health-panel";
import { ExportButton } from "@/components/exports/export-button";
import { formatLegalEntityKindSubkind } from "@/lib/admin/legal-entity-list-presenter";
import type { AdminLegalEntityDetailBundle } from "@/lib/admin/load-admin-legal-entity-detail";
import { presentStripeConnectAccount } from "@/lib/admin/stripe-connect-staff-presenter";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildLegalEntityOverviewViewModel } from "@/lib/data/view-models/legal-entity-overview.vm";
import {
  DetailColumns,
  KeyValueList,
  Section,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatGrid,
  TextLink,
} from "@auction/staff-ui";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

type Props = {
  entity: AdminLegalEntityDetailBundle["entity"];
  creator: AdminLegalEntityDetailBundle["creator"];
  health: AdminLegalEntityDetailBundle["health"];
  pendingDocCount?: number;
  activityEvents?: readonly AdminDomainEventRow[];
  canViewActivity?: boolean;
};

/**
 * The organisation at a glance: Stripe Connect, what Stripe still needs and documents waiting for
 * review; what blocks it from selling or being paid (once); its business facts; recent activity and the
 * record's dates in the rail.
 */
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
  const tile = (id: string) => vm.kpiTiles.find((item) => item.id === id);
  const stats = ["stripe", "requirements", "documents"].flatMap((id) => {
    const item = tile(id);
    return item ? [{ id: item.id, label: item.label, value: item.value }] : [];
  });

  const rail = (
    <>
      {canViewActivity ? (
        <Section
          title="Activity"
          action={
            <>
              <ExportButton
                entityType="domain-events"
                filters={{ aggregateType: "legal_entity", aggregateId: entity.id }}
              />
              <StaffButton asChild size="sm" variant="ghost">
                <Link href={`/admin/legal-entities/${entity.id}/activity`}>View all</Link>
              </StaffButton>
            </>
          }
        >
          <AuditTimeline
            label="Legal entity activity"
            events={activityEvents}
            limit={5}
            empty="No activity recorded for this organisation yet."
          />
        </Section>
      ) : null}
      <Section title="Record">
        <KeyValueList
          items={[
            { label: "Legal entity ID", value: entity.id, copyValue: entity.id },
            { label: "Created", value: <StaffDate value={entity.createdAt} withTime /> },
            { label: "Updated", value: <StaffDate value={entity.updatedAt} withTime /> },
          ]}
        />
      </Section>
    </>
  );

  return (
    <DetailColumns rail={rail} railLabel="Legal entity activity">
      <StatGrid label="Legal entity summary" className="grid-cols-3 md:grid-cols-3" items={stats} />
      <LegalEntityHealthPanel health={health} />
      <Section title="Business summary" description="Core business information.">
        <KeyValueList
          items={[
            { label: "Legal name", value: entity.legalName ?? null },
            { label: "Kind", value: formatLegalEntityKindSubkind(entity.kind, entity.subkind) },
            {
              label: "Created by",
              value: creator ? (
                <span className="flex flex-col">
                  <TextLink Link={NextLink} href={`/admin/clients/${creator.id}`}>
                    {creator.name}
                  </TextLink>
                  {creator.email ? (
                    <span className="text-staff-xs text-staff-muted">{creator.email}</span>
                  ) : null}
                </span>
              ) : null,
            },
            {
              label: "Stripe account",
              value: stripeAccount ? (
                <AdminStaffLabeledField
                  primary={stripeAccount.primary}
                  secondary={
                    entity.stripeConnectPayoutsEnabled
                      ? "Payouts enabled"
                      : "Payout setup in progress"
                  }
                />
              ) : null,
            },
            { label: "Managed by LAX", value: entity.isLaxManaged ? "Yes" : "No" },
            {
              label: "Platform fee",
              value: entity.platformFeeBps != null ? `${entity.platformFeeBps} bps` : null,
              numeric: true,
            },
          ]}
        />
      </Section>
    </DetailColumns>
  );
}
