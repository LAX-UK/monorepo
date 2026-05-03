import { PortfolioLotGrid } from "@/components/dashboard/portfolio-lot-grid";
import { PortfolioSearchBar } from "@/components/dashboard/portfolio-search";
import { Button } from "@/components/ui/button";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  filterPortfolioRowsByTitle,
  toPortfolioLotCards,
} from "@/lib/data/view-models/dashboard-portfolio.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";
import { Suspense } from "react";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function DashboardPortfolioPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qRaw = (sp.q ?? "").trim().toLowerCase();

  const container = await getServerDataContainer();
  let won: Awaited<ReturnType<typeof container.portfolio.listMine>> = [];
  let fetchError: string | null = null;
  try {
    won = await container.portfolio.listMine();
  } catch (e) {
    won = [];
    fetchError = e instanceof Error ? e.message : "Could not load portfolio.";
  }

  const filtered = filterPortfolioRowsByTitle(won, qRaw);
  const portfolioCards = toPortfolioLotCards(filtered);

  return (
    <div className="screen w-full">
      <PageHeader
        title="Private Collection"
        description="Lots where you are the winning bidder after the hammer fell."
        className="mb-6 border-0 pb-0"
      />

      {fetchError ? (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Could not load portfolio</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      {!fetchError ? (
        <Suspense
          fallback={
            <div
              className="mb-8 h-24 animate-pulse rounded-xl border border-outline-variant/15 bg-surface-container-lowest/60"
              aria-busy="true"
              aria-label="Loading search"
            />
          }
        >
          <PortfolioSearchBar initialQ={sp.q ?? ""} />
        </Suspense>
      ) : null}

      {filtered.length === 0 && !fetchError ? (
        <EmptyState
          title={qRaw ? "No matches" : "No acquired works yet"}
          description={
            qRaw
              ? "Try a different search term."
              : "You haven't won any lots yet. Browse live auctions and place your best bid."
          }
          action={
            !qRaw ? (
              <Button variant="primary" asChild>
                <Link href="/">Browse auctions</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <PortfolioLotGrid items={portfolioCards} variant="stacked" />
      )}
    </div>
  );
}
