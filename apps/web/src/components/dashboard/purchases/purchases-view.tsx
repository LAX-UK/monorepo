import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import { PaymentsMobileList } from "@/components/dashboard/list/payments-mobile-list";
import { PaymentRowCard } from "@/components/dashboard/payments/payment-row-card";
import { PortfolioLotGrid } from "@/components/dashboard/portfolio-lot-grid";
import type { PortfolioLotCardVm } from "@/components/dashboard/portfolio-lot-grid";
import { PortfolioNoticeToast } from "@/components/dashboard/portfolio-notice-toast";
import { PortfolioListToolbar } from "@/components/dashboard/portfolio/portfolio-list-toolbar";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/primitives";
import { DashboardDesktopList } from "@/components/dashboard/primitives/dashboard-list-row-card";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { PayNowBanner } from "@/components/dashboard/purchases/pay-now-banner";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import {
  PORTFOLIO_BASE_PATH,
  type PortfolioFilters,
  hasPortfolioActiveFilters,
} from "@/lib/dashboard/filters/portfolio/portfolio-filters";
import { kpiCompareHint } from "@/lib/dashboard/kpi-slot-conventions";
import type { PaymentDisplayRow } from "@/lib/data/view-models/dashboard-payments.vm";
import type { PayNowVm, PortfolioAnalyticsVm } from "@/lib/data/view-models/dashboard-portfolio.vm";
import { Button } from "@auction/ui/components/button";
import { Inbox } from "lucide-react";
import Link from "next/link";

type PurchasesViewProps = {
  filters: PortfolioFilters;
  /** Totals over everything the person has won, ignoring filters. */
  analytics: PortfolioAnalyticsVm;
  /** Totals the summary tiles show: the filtered subset while a filter is on. */
  kpiAnalytics: PortfolioAnalyticsVm;
  shownCount: number;
  payNow: PayNowVm | null;
  cards: PortfolioLotCardVm[];
  payments: PaymentDisplayRow[];
  loadFailure: DashboardSliceFailure | null;
  paymentsFailure: DashboardSliceFailure | null;
};

/**
 * The buyer's owned works and what they owe, in one page: a pinned "Pay now" while anything is
 * due, the won lots with their payment state, and the invoices below.
 */
export function PurchasesView({
  filters,
  analytics,
  kpiAnalytics,
  shownCount,
  payNow,
  cards,
  payments,
  loadFailure,
  paymentsFailure,
}: PurchasesViewProps) {
  const hasActiveFilters = hasPortfolioActiveFilters(filters);
  const filteredHint = hasActiveFilters ? kpiCompareHint(`${shownCount} shown`) : {};

  return (
    <DashboardListPage
      title="Purchases"
      description="Works you have won, what you owe and your invoices."
      banner={
        <>
          {payNow ? <PayNowBanner payNow={payNow} /> : null}
          <PortfolioNoticeToast />
        </>
      }
      toolbar={
        !loadFailure && analytics.totalRows > 0 ? (
          <PortfolioListToolbar filters={filters} years={analytics.years} />
        ) : null
      }
      errorAlert={loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
      className="space-y-8"
    >
      {!loadFailure && analytics.totalRows > 0 ? (
        <KpiRow
          text="plain"
          variant="hero"
          columns={4}
          stripClassName="md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2"
          aria-label="Purchases summary"
          tiles={[
            {
              id: "spent",
              label: "Total spent",
              value: kpiAnalytics.totalSpentFormatted,
              semanticTone: "emphasis",
              ...filteredHint,
            },
            {
              id: "outstanding",
              label: "Outstanding",
              value: kpiAnalytics.outstandingFormatted,
              semanticTone: kpiAnalytics.hasOutstanding ? "warning" : "default",
              // Jumps straight to paying when there is something that can be paid.
              ...(payNow?.href ? { href: payNow.href } : {}),
              ...filteredHint,
            },
          ]}
        />
      ) : null}

      {!loadFailure ? (
        <DashboardFilterResultsAnnouncer count={shownCount} entityLabel="works" />
      ) : null}

      {!loadFailure ? (
        <DashboardSection id="purchased-works" title="Works you have won">
          {shownCount === 0 ? (
            hasActiveFilters ? (
              <FilterEmptyState
                segment="dashboard"
                entity="works"
                clearFiltersHref={PORTFOLIO_BASE_PATH}
                browseHref="/search"
                browseLabel={DASHBOARD_CTA.browseLiveAuctions}
              />
            ) : (
              <DashboardEmptyState
                variant="hero"
                icon={<Inbox aria-hidden />}
                title={DASHBOARD_EMPTY.purchases.title}
                description={DASHBOARD_EMPTY.purchases.description}
                action={
                  <Button variant="primary" asChild>
                    <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
                  </Button>
                }
              />
            )
          ) : (
            <div className="min-w-0">
              <PortfolioLotGrid items={cards} variant="stacked" />
            </div>
          )}
        </DashboardSection>
      ) : null}

      {paymentsFailure ? (
        <DashboardSliceErrorAlert failure={paymentsFailure} />
      ) : payments.length > 0 ? (
        <DashboardSection id="payment-history" title="Payments and invoices">
          <PaymentsMobileList rows={payments} />
          <DashboardDesktopList>
            <ul className="divide-y divide-outline-variant/10">
              {payments.map((row) => (
                <PaymentRowCard key={row.id} row={row} />
              ))}
            </ul>
          </DashboardDesktopList>
        </DashboardSection>
      ) : null}
    </DashboardListPage>
  );
}
