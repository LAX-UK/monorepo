import { AttentionList } from "@/components/dashboard/attention-list";
import { ActionRequiredBanner } from "@/components/dashboard/overview/action-required-banner";
import { buildAttentionItems } from "@/components/dashboard/overview/build-attention-items";
import { buildOverviewKpiTiles } from "@/components/dashboard/overview/overview-presenters";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import type { KycStatusSummaryDto, OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { cn } from "@auction/ui";

type OverviewHeroBandProps = {
  vm: DashboardOverviewVm;
  kyc: KycStatusSummaryDto | null;
  orgOnboarding: OrgOnboardingResumeVm | null;
  orgModuleEnabled?: boolean;
  className?: string;
};

/** Focal above-the-fold band: KPIs, optional urgent settlement strip, compact attention list. */
export function OverviewHeroBand({
  vm,
  kyc,
  orgOnboarding,
  orgModuleEnabled = true,
  className,
}: OverviewHeroBandProps) {
  const firstSettlement = vm.settlementsDue[0];
  const attentionItems = buildAttentionItems({
    vm,
    kyc,
    orgOnboarding,
    orgModuleEnabled,
    skipFirstSettlement: Boolean(firstSettlement),
    suppressKycAttention: Boolean(kyc && kyc.requiresKyc !== true),
  });
  const hasAttention = attentionItems.length > 0;

  return (
    <section
      aria-label="Today at a glance"
      className={cn(
        "rounded-xl border border-border-hairline bg-surface-container-lowest p-4 shadow-lg sm:p-5",
        className,
      )}
    >
      <KpiRow
        variant="default"
        embedded
        columns={4}
        tiles={buildOverviewKpiTiles(vm)}
        aria-label="Summary metrics"
      />

      {firstSettlement ? (
        <div className="mt-4 border-t border-border-hairline pt-4">
          <ActionRequiredBanner row={firstSettlement} variant="strip" />
        </div>
      ) : null}

      {hasAttention ? (
        <div
          className="mt-4 border-t border-border-hairline pt-4"
          aria-label="Things that need your attention"
        >
          <AttentionList items={attentionItems} layout="grid" />
        </div>
      ) : null}
    </section>
  );
}
