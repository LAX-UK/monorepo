import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { ResultsFirstSaleEmpty } from "@/components/sections/results/results-first-sale-empty";
import { ResultsHero } from "@/components/sections/results/results-hero";
import { ResultsLoadError } from "@/components/sections/results/results-load-error";
import {
  ResultsLotsBody,
  ResultsLotsPagination,
  ResultsLotsToolbar,
} from "@/components/sections/results/results-lots-view";
import { ResultsSalesList } from "@/components/sections/results/results-sales-list";
import { ResultsSalesPagination } from "@/components/sections/results/results-sales-pagination";
import { ResultsViewTabs } from "@/components/sections/results/results-view-tabs";
import { SITE_SEO_NAME } from "@/lib/brand";
import { loadResultsLots } from "@/lib/marketing/load-results-lots";
import { loadResultsSalesPage, loadResultsYears } from "@/lib/marketing/load-results-sales";
import {
  type ResultsView,
  parseResultsPage,
  parseResultsView,
  resultsHref,
} from "@/lib/marketing/results-page-params";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { lotPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = metadataForStatic({
  title: "Results",
  description: `Prices, sell-through and sold works from every ${SITE_SEO_NAME} sale.`,
  path: "/results",
});

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Shell = {
  jsonLd: string;
  /** Tab counts that are known without a second read. */
  counts?: { sales?: number };
  toolbar?: ReactNode;
  footer?: ReactNode;
  body: ReactNode;
};

function breadcrumbsLd(): string {
  return jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Results", path: "/results" },
    ]),
  );
}

async function salesShell(page: number): Promise<Shell> {
  const result = await loadResultsSalesPage(page);
  if (!result.ok) {
    return {
      jsonLd: breadcrumbsLd(),
      body: <ResultsLoadError retryHref={resultsHref("sales", page)} />,
    };
  }
  const { rows, hasMore } = result.value;
  if (rows.length === 0) {
    return { jsonLd: breadcrumbsLd(), body: <ResultsFirstSaleEmpty /> };
  }
  return {
    jsonLd: breadcrumbsLd(),
    counts: hasMore || page > 1 ? {} : { sales: rows.length },
    body: <ResultsSalesList rows={rows} />,
    footer: <ResultsSalesPagination page={page} hasMore={hasMore} />,
  };
}

async function lotsShell(searchParams: Awaited<PageProps["searchParams"]>): Promise<Shell> {
  const [result, years] = await Promise.all([loadResultsLots(searchParams), loadResultsYears()]);
  if (!result.ok) {
    return {
      jsonLd: breadcrumbsLd(),
      body: <ResultsLoadError retryHref={resultsHref("lots")} />,
    };
  }
  const data = result.value;
  const base = getSiteUrl();
  const list =
    data.lots.length > 0
      ? itemListJsonLd(data.lots.map((lot) => ({ name: lot.title, url: `${base}${lotPath(lot)}` })))
      : null;
  return {
    jsonLd: jsonLdScript(
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Results", path: "/results" },
      ]),
      ...(list ? [list] : []),
    ),
    toolbar: <ResultsLotsToolbar data={data} years={years} />,
    body: <ResultsLotsBody data={data} />,
    footer: <ResultsLotsPagination data={data} />,
  };
}

function loadShell(
  view: ResultsView,
  searchParams: Awaited<PageProps["searchParams"]>,
): Promise<Shell> {
  return view === "lots" ? lotsShell(searchParams) : salesShell(parseResultsPage(searchParams));
}

export default async function ResultsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view = parseResultsView(sp);
  const shell = await loadShell(view, sp);

  return (
    <MarketingCatalogHubShell
      jsonLd={
        <script type="application/ld+json" suppressHydrationWarning>
          {shell.jsonLd}
        </script>
      }
      hero={<ResultsHero />}
      toolbar={
        <>
          <ResultsViewTabs active={view} counts={shell.counts ?? {}} className="mb-6" />
          {shell.toolbar}
        </>
      }
      {...(shell.footer ? { footer: shell.footer } : {})}
    >
      {shell.body}
    </MarketingCatalogHubShell>
  );
}
