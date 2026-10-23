import { PurchasesView } from "@/components/dashboard/purchases/purchases-view";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import {
  hasPortfolioActiveFilters,
  parsePortfolioParams,
} from "@/lib/dashboard/filters/portfolio/portfolio-filters";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerBuyerComplianceGate } from "@/lib/data/http/payments.server";
import {
  type PaymentDisplayRow,
  sortPaymentsNewestFirst,
  toPaymentDisplayRows,
} from "@/lib/data/view-models/dashboard-payments.vm";
import {
  buildPayNow,
  buildPortfolioAnalytics,
  filterPortfolioRows,
  toPortfolioLotCards,
} from "@/lib/data/view-models/dashboard-portfolio.vm";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";

type PageProps = {
  searchParams: Promise<{ q?: string; payment?: string; year?: string }>;
};

export default async function DashboardPurchasesPage({ searchParams }: PageProps) {
  const filters = parsePortfolioParams(await searchParams);

  const container = await getServerDataContainer();
  let won: Awaited<ReturnType<typeof container.portfolio.listMine>> = [];
  let loadFailure: DashboardSliceFailure | null = null;
  let complianceGate: Awaited<ReturnType<typeof getServerBuyerComplianceGate>> = "clear";
  let payments: PaymentDisplayRow[] = [];
  let paymentsFailure: DashboardSliceFailure | null = null;

  const [wonResult, gateResult, paymentsResult] = await Promise.allSettled([
    container.portfolio.listMine(),
    getServerBuyerComplianceGate(),
    container.payments.listMine(),
  ]);
  if (wonResult.status === "fulfilled") {
    won = wonResult.value;
    complianceGate = gateResult.status === "fulfilled" ? gateResult.value : "clear";
  } else {
    loadFailure = describeDashboardSliceFailure(
      wonResult.reason,
      "portfolio",
      "Could not load your purchases.",
    );
  }
  if (paymentsResult.status === "fulfilled") {
    payments = sortPaymentsNewestFirst(toPaymentDisplayRows(paymentsResult.value));
  } else {
    paymentsFailure = describeDashboardSliceFailure(
      paymentsResult.reason,
      "payments",
      "Could not load your payments.",
    );
  }

  const filtered = filterPortfolioRows(won, {
    qLower: filters.q.trim().toLowerCase(),
    payment: filters.payment,
    year: filters.year,
  });
  const analytics = buildPortfolioAnalytics(won);
  const artistNameById = await resolveArtistNames(filtered.map((row) => row.lot.artistId ?? null));

  return (
    <PurchasesView
      meta={await readClientWorkspacePageMeta()}
      filters={filters}
      analytics={analytics}
      kpiAnalytics={
        hasPortfolioActiveFilters(filters) ? buildPortfolioAnalytics(filtered) : analytics
      }
      shownCount={filtered.length}
      payNow={loadFailure ? null : buildPayNow(won, complianceGate)}
      cards={toPortfolioLotCards(filtered, { artistNameById, complianceGate })}
      payments={payments}
      loadFailure={loadFailure}
      paymentsFailure={paymentsFailure}
    />
  );
}
