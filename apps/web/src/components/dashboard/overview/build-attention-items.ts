import type { AttentionListItem } from "@/components/dashboard/attention-list";
import { formatSettlementTotal } from "@/components/dashboard/overview/overview-presenters";
import {
  KYC_ATTENTION_REQUIRED_HINT,
  isKycInReview,
  isKycSessionContinuable,
  kycLinkActionLabel,
  resolveKycFeedback,
} from "@/components/kyc/kyc-copy";
import type { KycStatusSummaryDto, OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { portfolioSettlementAttentionAction } from "@/lib/portfolio-settlement";
import { lotPath } from "@/lib/seo/url";

export type BuildAttentionItemsOptions = {
  vm: DashboardOverviewVm;
  kyc: KycStatusSummaryDto | null;
  orgOnboarding: OrgOnboardingResumeVm | null;
  orgModuleEnabled?: boolean;
  /** If true, the urgent first settlement is already shown by ActionRequiredBanner. */
  skipFirstSettlement?: boolean;
  /** When true, skip KYC items — compliance strip already surfaces identity state. */
  suppressKycAttention?: boolean;
  /** When true, skip org onboarding — layout banner stack already surfaces it. */
  suppressOrgOnboardingAttention?: boolean;
};

/** Aggregates attention items for overview hero band and attention panel. */
export function buildAttentionItems({
  vm,
  kyc,
  orgOnboarding,
  orgModuleEnabled = true,
  skipFirstSettlement = false,
  suppressKycAttention = false,
  suppressOrgOnboardingAttention = false,
}: BuildAttentionItemsOptions): AttentionListItem[] {
  const items: AttentionListItem[] = [];

  if (kyc && !suppressKycAttention) {
    const feedback = resolveKycFeedback(kyc);
    if (kyc.feedback?.needsResubmit) {
      items.push({
        id: "kyc-resubmit",
        title: kyc.feedback.headline,
        hint: kyc.feedback.detail ?? "Complete the missing checks and resubmit.",
        href: "/dashboard/verify-identity",
        ctaLabel: kycLinkActionLabel(feedback, "short"),
      });
    } else if (isKycInReview(kyc)) {
      items.push({
        id: "kyc-pending",
        title: "Identity verification in review",
        hint: feedback.detail ?? "We will notify you once the check completes",
        href: "/dashboard/verify-identity",
        ctaLabel: kycLinkActionLabel(feedback, "short"),
      });
    } else if (isKycSessionContinuable(kyc)) {
      items.push({
        id: "kyc-continuable",
        title: feedback.headline,
        hint: feedback.detail ?? "Complete the document and selfie checks in the secure window.",
        href: "/dashboard/verify-identity",
        ctaLabel: kycLinkActionLabel(feedback, "short"),
      });
    } else if (kyc.status === "rejected") {
      items.push({
        id: "kyc-rejected",
        title: kyc.feedback?.headline ?? "Identity verification was rejected",
        hint: kyc.feedback?.detail ?? "Resubmit to keep bidding above the threshold",
        href: "/dashboard/verify-identity",
        ctaLabel: "Resubmit",
      });
    } else if (kyc.requiresKyc && kyc.status !== "approved") {
      items.push({
        id: "kyc-required",
        title: "Identity verification required",
        hint: KYC_ATTENTION_REQUIRED_HINT,
        href: "/dashboard/verify-identity",
        ctaLabel: "Verify",
      });
    }
  }

  if (orgModuleEnabled && orgOnboarding && !suppressOrgOnboardingAttention) {
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
    const action = portfolioSettlementAttentionAction(row);
    items.push({
      id: `settlement-${row.lot.id}`,
      title: `Payment due: ${row.lot.title}`,
      hint: `Total ${formatSettlementTotal(row)}`,
      href: action.href,
      ctaLabel: action.label === "Complete checkout" ? "Pay" : action.label,
    });
  }

  const outbidEntries = vm.activeBidLots.filter((entry) => entry.hint === "outbid");
  for (const entry of outbidEntries.slice(0, 3)) {
    const lot = entry.lot;
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
