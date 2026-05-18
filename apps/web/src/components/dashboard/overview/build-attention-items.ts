import type { AttentionListItem } from "@/components/dashboard/attention-list";
import { formatSettlementTotal } from "@/components/dashboard/overview/overview-presenters";
import type { KycStatusSummaryDto, OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { lotPath } from "@/lib/seo/url";

export type BuildAttentionItemsOptions = {
  vm: DashboardOverviewVm;
  kyc: KycStatusSummaryDto | null;
  orgOnboarding: OrgOnboardingResumeVm | null;
  /** If true, the urgent first settlement is already shown by ActionRequiredBanner. */
  skipFirstSettlement?: boolean;
};

/** Aggregates attention items for overview hero band and attention panel. */
export function buildAttentionItems({
  vm,
  kyc,
  orgOnboarding,
  skipFirstSettlement = false,
}: BuildAttentionItemsOptions): AttentionListItem[] {
  const items: AttentionListItem[] = [];

  if (kyc) {
    if (kyc.status === "rejected") {
      items.push({
        id: "kyc-rejected",
        title: "Identity verification was rejected",
        hint: "Resubmit to keep bidding above the threshold",
        href: "/dashboard/verify-identity",
        ctaLabel: "Resubmit",
      });
    } else if (kyc.status === "pending") {
      items.push({
        id: "kyc-pending",
        title: "Identity verification in review",
        hint: "We will notify you once the check completes",
        href: "/dashboard/verify-identity",
        ctaLabel: "View",
      });
    } else if (kyc.requiresKyc && kyc.status !== "approved") {
      items.push({
        id: "kyc-required",
        title: "Identity verification required",
        hint: "Required to settle pending invoices",
        href: "/dashboard/verify-identity",
        ctaLabel: "Verify",
      });
    }
  }

  if (orgOnboarding) {
    items.push({
      id: `org-${orgOnboarding.entityId}`,
      title: `Finish onboarding for ${orgOnboarding.displayName}`,
      hint: "Required to bid as this organisation",
      href: orgOnboarding.resumeHref,
      ctaLabel: "Resume",
    });
  }

  const settlements = skipFirstSettlement ? vm.settlementsDue.slice(1) : vm.settlementsDue;
  for (const row of settlements) {
    items.push({
      id: `settlement-${row.lot.id}`,
      title: `Payment due: ${row.lot.title}`,
      hint: `Total ${formatSettlementTotal(row)}`,
      href: `/dashboard/checkout/${row.lot.id}`,
      ctaLabel: "Pay",
    });
  }

  const outbidLots = vm.activeLots.filter((lot) => vm.activeLotBidHints[lot.id] === "outbid");
  for (const lot of outbidLots.slice(0, 3)) {
    items.push({
      id: `outbid-${lot.id}`,
      title: `Outbid on ${lot.title}`,
      hint: "Place a higher bid before the lot closes",
      href: lotPath(lot),
      ctaLabel: "Re-bid",
    });
  }

  for (const row of vm.endingSoonWatchlist.slice(0, 2)) {
    if (!row.lot) continue;
    items.push({
      id: `ending-${row.lot.id}`,
      title: `Closing soon: ${row.lot.title}`,
      hint: "On your watchlist — ends within 24 hours",
      href: lotPath(row.lot),
      ctaLabel: "Open",
    });
  }

  return items;
}
