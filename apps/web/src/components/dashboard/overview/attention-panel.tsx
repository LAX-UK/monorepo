import { AttentionList, type AttentionListItem } from "@/components/dashboard/attention-list";
import { formatSettlementTotal } from "@/components/dashboard/overview/overview-presenters";
import type { KycStatusSummaryDto } from "@/lib/data/http/kyc.server";
import type { OrgOnboardingResumeVm } from "@/lib/data/http/org-onboarding.server";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { lotPath } from "@/lib/seo/url";
import { LabelCaps } from "@auction/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";

type AttentionPanelProps = {
  vm: DashboardOverviewVm;
  kyc: KycStatusSummaryDto | null;
  orgOnboarding: OrgOnboardingResumeVm | null;
  /** If true, the urgent first settlement is already shown by ActionRequiredBanner. */
  skipFirstSettlement?: boolean;
};

/** Aggregated "what needs your attention" surface.
 *
 * Renders nothing when there are no items so the layout collapses cleanly.
 */
export function AttentionPanel({
  vm,
  kyc,
  orgOnboarding,
  skipFirstSettlement = false,
}: AttentionPanelProps) {
  const items: AttentionListItem[] = [];

  // KYC required — pending exposure has crossed the buyer threshold or the
  // session is rejected/in-flight. Surfaced before settlements because checkout
  // is blocked until it clears.
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

  // Org onboarding resume — bidding as an organisation is blocked until done.
  if (orgOnboarding) {
    items.push({
      id: `org-${orgOnboarding.entityId}`,
      title: `Finish onboarding for ${orgOnboarding.displayName}`,
      hint: "Required to bid as this organisation",
      href: orgOnboarding.resumeHref,
      ctaLabel: "Resume",
    });
  }

  // Settlements due — skip the first one if the urgent banner is already shown.
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

  // Outbid lots — most actionable bidding signal.
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

  // Ending soon watchlist — gentle nudge, capped at 2 so the list does not
  // dominate.
  for (const row of vm.endingSoonWatchlist.slice(0, 2)) {
    if (!row.lot) continue;
    items.push({
      id: `ending-${row.lot.id}`,
      title: `Closing soon: ${row.lot.title}`,
      hint: "On your watchlist \u2014 ends within 24 hours",
      href: lotPath(row.lot),
      ctaLabel: "Open",
    });
  }

  if (items.length === 0) return null;

  return (
    <Card
      aria-label="Things that need your attention"
      className="border-outline-variant/15 bg-surface-container-lowest shadow-lg"
    >
      <CardHeader className="space-y-2">
        <LabelCaps className="text-primary">Needs attention</LabelCaps>
        <div>
          <CardTitle className="font-headline text-xl font-semibold tracking-tight md:text-2xl">
            {items.length === 1
              ? "1 item needs your attention"
              : `${items.length} items need your attention`}
          </CardTitle>
          <CardDescription>
            Payments, verification, and bidding actions to keep your auction workflow moving.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <AttentionList items={items} />
      </CardContent>
    </Card>
  );
}
