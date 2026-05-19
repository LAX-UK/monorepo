import {
  DashboardComplianceStrip,
  DashboardComplianceStripSkeleton,
} from "@/components/dashboard/dashboard-compliance-strip";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import {
  type PortfolioFilterValue,
  PortfolioFilters,
} from "@/components/dashboard/portfolio-filters";
import { PortfolioLotGrid } from "@/components/dashboard/portfolio-lot-grid";
import { PortfolioNoticeToast } from "@/components/dashboard/portfolio-notice-toast";
import {
  DashboardEmptyState,
  DashboardErrorAlert,
  DashboardSection,
} from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { DashboardToolbar } from "@/components/dashboard/primitives/dashboard-toolbar";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { Button } from "@/components/ui/button";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  buildPortfolioAnalytics,
  filterPortfolioRows,
  toPortfolioLotCards,
} from "@/lib/data/view-models/dashboard-portfolio.vm";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const PAYMENT_VALUES: ReadonlyArray<PortfolioFilterValue> = [
  "all",
  "due",
  "paid",
  "authorized",
  "refunded",
];

function parsePaymentFilter(raw: string | undefined): PortfolioFilterValue {
  if (raw && (PAYMENT_VALUES as readonly string[]).includes(raw)) {
    return raw as PortfolioFilterValue;
  }
  return "all";
}

function parseYearFilter(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1900 || n > 3000) return null;
  return n;
}

type PageProps = {
  searchParams: Promise<{ q?: string; payment?: string; year?: string }>;
};

export default async function DashboardPortfolioPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qRaw = (sp.q ?? "").trim().toLowerCase();
  const payment = parsePaymentFilter(sp.payment);
  const year = parseYearFilter(sp.year);

  const container = await getServerDataContainer();
  let won: Awaited<ReturnType<typeof container.portfolio.listMine>> = [];
  let fetchError: string | null = null;
  try {
    won = await container.portfolio.listMine();
  } catch (e) {
    won = [];
    fetchError = e instanceof Error ? e.message : "Could not load portfolio.";
  }

  const analytics = buildPortfolioAnalytics(won);
  const filtered = filterPortfolioRows(won, { qLower: qRaw, payment, year });
  const artistIds = filtered.map((row) => row.lot.artistId ?? null);
  const artistNameById = await resolveArtistNames(artistIds);
  const portfolioCards = toPortfolioLotCards(filtered, { artistNameById });

  return (
    <DashboardPage className="space-y-8">
      <PortfolioNoticeToast />
      <DashboardPageHeader
        meta="Buying"
        title="Private Collection"
        description="Lots where you are the winning bidder after the hammer fell."
      />

      <Suspense fallback={<DashboardComplianceStripSkeleton />}>
        <DashboardComplianceStrip loginNext="/dashboard/portfolio" />
      </Suspense>

      {fetchError ? (
        <DashboardErrorAlert
          title="Could not load portfolio"
          message={`${fetchError} Refresh the page or try again in a few minutes.`}
        />
      ) : null}

      {!fetchError && analytics.totalRows > 0 ? (
        <KpiRow
          variant="hero"
          columns={4}
          className="xl:grid-cols-3"
          aria-label="Collection summary"
          tiles={[
            {
              id: "spent",
              label: "Total spent",
              value: analytics.totalSpentFormatted,
              semanticTone: "emphasis",
            },
            {
              id: "outstanding",
              label: "Outstanding",
              value: analytics.outstandingFormatted,
              semanticTone: analytics.hasOutstanding ? "warning" : "default",
            },
            {
              id: "year",
              label: "This year",
              value: String(analytics.wonThisYear),
            },
          ]}
        />
      ) : null}

      {!fetchError ? (
        <DashboardToolbar
          search={
            <PortfolioFilters
              initialQ={sp.q ?? ""}
              payment={payment}
              year={year}
              years={analytics.years}
            />
          }
        />
      ) : null}

      {!fetchError ? (
        <DashboardSection id="portfolio-grid" title="Acquired works">
          {filtered.length === 0 ? (
            <DashboardEmptyState
              variant={!qRaw && payment === "all" && year == null ? "hero" : "quiet"}
              icon={!qRaw && payment === "all" && year == null ? <Inbox aria-hidden /> : undefined}
              title={
                qRaw || payment !== "all" || year != null ? "No matches" : "No acquired works yet"
              }
              description={
                qRaw || payment !== "all" || year != null
                  ? "Try a different search term or clear the filters."
                  : "You haven't won any lots yet. Browse live auctions and place your best bid."
              }
              action={
                !qRaw && payment === "all" && year == null ? (
                  <Button variant="primary" asChild>
                    <Link href="/search">Browse auctions</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="min-w-0">
              <PortfolioLotGrid items={portfolioCards} variant="stacked" />
            </div>
          )}
        </DashboardSection>
      ) : null}
    </DashboardPage>
  );
}
