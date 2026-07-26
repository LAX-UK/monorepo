import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { DetailAttentionRow } from "@/lib/admin/detail-board/types";
import type { LegalEntityHealthVM } from "@/lib/admin/legal-entity-health";
import { stripeSummaryLabel } from "@/lib/admin/legal-entity-list-presenter";
import { stripeRequirementsAttentionCountForEntity } from "@/lib/admin/stripe-connect-staff-presenter";
import type { LegalEntity } from "@auction/types";

type BuildLegalEntityOverviewInput = {
  entity: LegalEntity;
  health: LegalEntityHealthVM;
  pendingDocCount?: number;
};

export type LegalEntityOverviewViewModel = {
  kpiTiles: readonly DetailBoardKpiTile[];
  blockerRows: readonly DetailAttentionRow[];
};

function stripeConnectLabel(entity: LegalEntity): string {
  if (!entity.stripeConnectAccountId) return "Not connected";
  if (entity.stripeConnectPayoutsEnabled) return "Payouts enabled";
  return "Setup in progress";
}

/** KPI band + blocker rows for legal entity overview — catalog detail board language. */
export function buildLegalEntityOverviewViewModel(
  input: BuildLegalEntityOverviewInput,
): LegalEntityOverviewViewModel {
  const { entity, health, pendingDocCount = 0 } = input;
  const stripeDueCount = stripeRequirementsAttentionCountForEntity(entity);

  const kpiTiles: DetailBoardKpiTile[] = [
    {
      id: "status",
      label: "Lifecycle",
      value: entity.status.replace(/_/g, " "),
      trendTone: entity.status === "approved" ? "secondary" : "accent-gold",
    },
    {
      id: "stripe",
      label: "Stripe Connect",
      value: stripeConnectLabel(entity),
      trendTone: entity.stripeConnectPayoutsEnabled ? "secondary" : "accent-gold",
    },
    {
      id: "requirements",
      label: "Requirements due",
      value: stripeDueCount > 0 ? stripeSummaryLabel(stripeDueCount) : "None",
      trendTone: stripeDueCount > 0 ? "accent-gold" : "muted",
    },
    {
      id: "documents",
      label: "Pending documents",
      value: String(pendingDocCount),
      trendTone: pendingDocCount > 0 ? "accent-gold" : "muted",
    },
    {
      id: "managed",
      label: "LAX managed",
      value: entity.isLaxManaged ? "Yes" : "No",
      trendTone: "muted",
    },
    {
      id: "fee",
      label: "Platform fee",
      value: entity.platformFeeBps != null ? `${entity.platformFeeBps} bps` : "—",
      trendTone: "muted",
    },
  ];

  const blockerRows: DetailAttentionRow[] = health.blockers.map((blocker) => ({
    id: blocker.key,
    title: blocker.label,
    count: 1,
    category: health.stageLabel,
    severity: health.canPublish && health.canReceivePayouts ? "medium" : "high",
    actionLabel: "Review",
    iconKind: "finance",
  }));

  return { kpiTiles, blockerRows };
}
