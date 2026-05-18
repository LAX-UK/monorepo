import { AttentionList } from "@/components/dashboard/attention-list";
import { buildAttentionItems } from "@/components/dashboard/overview/build-attention-items";
import type { KycStatusSummaryDto, OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";

type AttentionPanelProps = {
  vm: DashboardOverviewVm;
  kyc: KycStatusSummaryDto | null;
  orgOnboarding: OrgOnboardingResumeVm | null;
  /** If true, the urgent first settlement is already shown by ActionRequiredBanner. */
  skipFirstSettlement?: boolean;
};

/** Standalone attention list (prefer OverviewHeroBand on overview). */
export function AttentionPanel({
  vm,
  kyc,
  orgOnboarding,
  skipFirstSettlement = false,
}: AttentionPanelProps) {
  const items = buildAttentionItems({ vm, kyc, orgOnboarding, skipFirstSettlement });
  if (items.length === 0) return null;

  return (
    <section aria-label="Things that need your attention">
      <AttentionList items={items} />
    </section>
  );
}
