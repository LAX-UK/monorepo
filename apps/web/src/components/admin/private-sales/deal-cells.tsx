import {
  DEAL_STAGE_BADGES,
  DEAL_STAGE_LABELS,
  dealDeadline,
  describeDeadline,
} from "@/lib/admin/private-sales/private-sales.vm";
import type { DealListItem } from "@/lib/data/http/admin-private-sales.schema";
import { EmptyValue, StatusBadge } from "@auction/staff-ui";
import type { PrivateSaleDealStage } from "@auction/types";

export function DealStageBadge({ stage }: { stage: PrivateSaleDealStage }) {
  const badge = DEAL_STAGE_BADGES[stage];
  return (
    <StatusBadge tone={badge.tone} shape={badge.shape}>
      {DEAL_STAGE_LABELS[stage]}
    </StatusBadge>
  );
}

/** The date the deal is waiting for, with what it is; nothing once it has no deadline. */
export function DeadlineCell({ deal }: { deal: DealListItem }) {
  const deadline = dealDeadline(deal);
  if (!deadline) return <EmptyValue />;
  return <span className="tabular-nums text-staff-muted">{describeDeadline(deadline)}</span>;
}
