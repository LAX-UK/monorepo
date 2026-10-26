import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { AdminFinanceIssuesPayload } from "@/lib/data/http/admin-ops-dashboard.types";
import type { AttentionItem, LinkListItem } from "@auction/staff-ui";

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * The finance desk's queues, most urgent first, each linking to the list filtered to exactly
 * those records. Empty queues drop out in the kit list.
 */
export function financeAttention(
  navCounts: AdminNavCounts,
  issues: AdminFinanceIssuesPayload | null,
  failedPayouts: number,
): AttentionItem[] {
  const items: AttentionItem[] = [
    {
      id: "failed-payouts",
      count: failedPayouts,
      label: plural(
        failedPayouts,
        "payout failed or was reversed",
        "payouts failed or were reversed",
      ),
      href: "/admin/payouts?status=failed",
      tone: "danger",
    },
    {
      id: "disputes",
      count: navCounts.disputesOpen,
      label: plural(navCounts.disputesOpen, "dispute is open", "disputes are open"),
      href: "/admin/disputes",
      tone: "danger",
    },
    {
      id: "manual-review",
      count: navCounts.manualReviewCount,
      label: plural(
        navCounts.manualReviewCount,
        "payment needs manual review before capture",
        "payments need manual review before capture",
      ),
      href: "/admin/payments?manualReview=1",
      tone: "warning",
    },
  ];
  if (issues) {
    items.push(
      {
        id: "blocked-payouts",
        count: issues.staleBlockedScheduledPayoutCount,
        label: plural(
          issues.staleBlockedScheduledPayoutCount,
          "scheduled payout is blocked",
          "scheduled payouts are blocked",
        ),
        href: "/admin/payouts/settlement",
        tone: "warning",
      },
      {
        id: "connect",
        count: issues.legalEntitiesWithStripeConnectRequirementsCount,
        label: plural(
          issues.legalEntitiesWithStripeConnectRequirementsCount,
          "seller's payout account needs details in Stripe",
          "sellers' payout accounts need details in Stripe",
        ),
        href: "/admin/legal-entities?stripe=1",
        tone: "warning",
      },
      {
        id: "entities",
        count: issues.entitiesPendingReviewCount,
        label: plural(
          issues.entitiesPendingReviewCount,
          "legal entity waits for review",
          "legal entities wait for review",
        ),
        href: "/admin/onboarding-issues?tab=entities",
      },
      {
        id: "artists",
        count: issues.artistsPendingApprovalCount,
        label: plural(
          issues.artistsPendingApprovalCount,
          "artist waits for approval",
          "artists wait for approval",
        ),
        href: "/admin/onboarding-issues?tab=artists",
      },
      {
        id: "kyc",
        count: issues.staleKycSessionsCount,
        label: plural(
          issues.staleKycSessionsCount,
          "identity check has stalled",
          "identity checks have stalled",
        ),
        href: "/admin/onboarding-issues?tab=kyc",
      },
      {
        id: "documents",
        count: issues.documentsAwaitingReviewCount,
        label: plural(
          issues.documentsAwaitingReviewCount,
          "document waits for review",
          "documents wait for review",
        ),
        href: "/admin/onboarding-issues?tab=documents",
      },
      {
        id: "orgs",
        count: issues.staleLeadOrganisationsCount,
        label: plural(
          issues.staleLeadOrganisationsCount,
          "lead organisation has gone quiet",
          "lead organisations have gone quiet",
        ),
        href: "/admin/onboarding-issues?tab=orgs",
      },
    );
  }
  return items;
}

/** Where the finance desk works, each with what waits there. */
export function financeTools(navCounts: AdminNavCounts): LinkListItem[] {
  return [
    {
      id: "payments",
      label: "Payments",
      description: "Buyer payments for won lots: capture, refund and review.",
      href: "/admin/payments",
      count: navCounts.manualReviewCount,
    },
    {
      id: "payouts",
      label: "Payouts",
      description: "Transfers to sellers, by status.",
      href: "/admin/payouts",
      count: navCounts.payoutsFailed,
    },
    {
      id: "settlement",
      label: "Settlement run",
      description: "Pay sellers for settled lots, one legal entity at a time.",
      href: "/admin/payouts/settlement",
    },
    {
      id: "disputes",
      label: "Disputes",
      description: "Card disputes raised by buyers.",
      href: "/admin/disputes",
      count: navCounts.disputesOpen,
    },
    {
      id: "xero",
      label: "Xero",
      description: "Invoices and bills sent to the accounts.",
      href: "/admin/integrations/xero",
    },
  ];
}
