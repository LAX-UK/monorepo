import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { stripeSummaryLabel } from "@/lib/admin/legal-entity-list-presenter";
import { stripeRequirementsAttentionCountForEntity } from "@/lib/admin/stripe-connect-staff-presenter";
import type { LegalEntity } from "@auction/types";

type Props = {
  entity: LegalEntity;
};

export function LegalEntitySummaryStrip({ entity }: Props) {
  const stripeConnect = entity.stripeConnectAccountId
    ? entity.stripeConnectPayoutsEnabled
      ? "Payouts enabled"
      : "Setup in progress"
    : "Not connected";
  const dueCount = stripeRequirementsAttentionCountForEntity(entity);

  return (
    <KpiRow
      embedded
      columns={4}
      className="mt-2"
      tiles={[
        { id: "stripe", label: "Stripe Connect", value: stripeConnect },
        {
          id: "due",
          label: "Requirements due",
          value: dueCount > 0 ? stripeSummaryLabel(dueCount) : "None",
        },
        {
          id: "managed",
          label: "LAX managed",
          value: entity.isLaxManaged ? "Yes" : "No",
        },
        {
          id: "fee",
          label: "Platform fee",
          value: entity.platformFeeBps != null ? `${entity.platformFeeBps} bps` : "—",
        },
      ]}
    />
  );
}
