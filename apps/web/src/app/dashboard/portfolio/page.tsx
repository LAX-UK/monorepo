import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import { PortfolioLotGrid } from "@/components/dashboard/portfolio-lot-grid";
import { PortfolioNoticeToast } from "@/components/dashboard/portfolio-notice-toast";
import { PortfolioListToolbar } from "@/components/dashboard/portfolio/portfolio-list-toolbar";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/primitives";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import {
  PORTFOLIO_BASE_PATH,
  hasPortfolioActiveFilters,
  parsePortfolioParams,
} from "@/lib/dashboard/filters/portfolio/portfolio-filters";
import { kpiCompareHint } from "@/lib/dashboard/kpi-slot-conventions";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  buildPortfolioAnalytics,
  filterPortfolioRows,
  toPortfolioLotCards,
} from "@/lib/data/view-models/dashboard-portfolio.vm";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import { Button } from "@auction/ui/components/button";
import { Inbox } from "lucide-react";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ q?: string; payment?: string; year?: string }>;
};

export default async function DashboardPortfolioPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parsePortfolioParams(sp);
  const qRaw = filters.q.trim().toLowerCase();
  const payment = filters.payment;
  const year = filters.year;

  const container = await getServerDataContainer();
  let won: Awaited<ReturnType<typeof container.portfolio.listMine>> = [];
  let loadFailure: DashboardSliceFailure | null = null;
  try {
    won = await container.portfolio.listMine();
  } catch (e) {
    won = [];
    loadFailure = describeDashboardSliceFailure(e, "portfolio", "Could not load portfolio.");
  }

  const analytics = buildPortfolioAnalytics(won);
  const filtered = filterPortfolioRows(won, { qLower: qRaw, payment, year });
  const hasActiveFilters = hasPortfolioActiveFilters(filters);
  const kpiAnalytics = hasActiveFilters ? buildPortfolioAnalytics(filtered) : analytics;
  const filteredHint = hasActiveFilters ? kpiCompareHint(`${filtered.length} shown`) : {};
  const artistIds = filtered.map((row) => row.lot.artistId ?? null);
  const artistNameById = await resolveArtistNames(artistIds);
  const portfolioCards = toPortfolioLotCards(filtered, { artistNameById });
  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardListPage
      meta={workspaceMeta}
      title="Collection"
      description="Lots where you are the winning bidder after the hammer fell."
      banner={<PortfolioNoticeToast />}
      toolbar={
        !loadFailure ? <PortfolioListToolbar filters={filters} years={analytics.years} /> : null
      }
      errorAlert={loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
      className="space-y-8"
    >
      {!loadFailure && analytics.totalRows > 0 ? (
        <KpiRow
          variant="hero"
          columns={4}
          className="xl:grid-cols-3"
          aria-label="Collection summary"
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
              ...filteredHint,
            },
            {
              id: "year",
              label: "This year",
              value: String(kpiAnalytics.wonThisYear),
              ...(hasActiveFilters ? filteredHint : kpiCompareHint("Acquired lots")),
            },
          ]}
        />
      ) : null}

      {!loadFailure ? (
        <DashboardFilterResultsAnnouncer count={filtered.length} entityLabel="works" />
      ) : null}

      {!loadFailure ? (
        <DashboardSection id="portfolio-grid" title="Acquired works">
          {filtered.length === 0 ? (
            hasPortfolioActiveFilters(filters) ? (
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
                title={DASHBOARD_EMPTY.portfolio.title}
                description={DASHBOARD_EMPTY.portfolio.description}
                action={
                  <Button variant="primary" asChild>
                    <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
                  </Button>
                }
              />
            )
          ) : (
            <div className="min-w-0">
              <PortfolioLotGrid items={portfolioCards} variant="stacked" />
            </div>
          )}
        </DashboardSection>
      ) : null}
    </DashboardListPage>
  );
}
