import { connectGapStageLabel } from "@/lib/connect/connect-gap-copy";
import { getConnectGapState, isSellerConnectReady } from "@auction/connect";
import type { LegalEntity } from "@auction/types";

export type LegalEntityHealthBlocker = {
  key: string;
  label: string;
  hint: string;
};

export type LegalEntityHealthVM = {
  canPublish: boolean;
  canReceivePayouts: boolean;
  stageLabel: string;
  blockers: LegalEntityHealthBlocker[];
  statusReason: string | null;
};

/** Pure org health snapshot for staff legal-entity detail (Connect + lifecycle). */
export function buildLegalEntityHealthVM(entity: LegalEntity): LegalEntityHealthVM {
  const gap = getConnectGapState(entity);
  const statusReason = entity.statusReason?.trim() || null;

  const blockers: LegalEntityHealthBlocker[] = gap.missing.map((item) => ({
    key: item.key,
    label: item.label,
    hint: item.hint,
  }));

  if (statusReason && !blockers.some((b) => b.hint === statusReason)) {
    blockers.unshift({
      key: "status_reason",
      label: "Status note",
      hint: statusReason,
    });
  }

  if (
    entity.status !== "approved" &&
    !entity.isLaxManaged &&
    !blockers.some((b) => b.key === "lifecycle_status")
  ) {
    blockers.unshift({
      key: "lifecycle_status",
      label: "Lifecycle status",
      hint: `Entity is ${entity.status.replace(/_/g, " ")} — approval required before selling.`,
    });
  }

  return {
    canPublish: isSellerConnectReady(entity),
    canReceivePayouts: gap.canReceivePayouts,
    stageLabel: connectGapStageLabel(gap.stage),
    blockers,
    statusReason,
  };
}
