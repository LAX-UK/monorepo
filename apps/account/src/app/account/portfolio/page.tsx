import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { PortfolioAttention } from "@/components/portfolio-attention";
import { PortfolioEmptyState } from "@/components/portfolio-empty-state";
import { PortfolioHeader } from "@/components/portfolio-header";
import { PortfolioHoldings } from "@/components/portfolio-holdings";
import { PortfolioNotices } from "@/components/portfolio-notices";
import { loadPortfolioItems } from "@/server/application/load-portfolio-data";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountProducts } from "@/server/domain/account-products.vm";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import { buildSourceNotices } from "@/server/domain/portfolio-composition";
import { buildPortfolioPage } from "@/server/domain/portfolio-page.vm";
import { type PortfolioSearchParams, parseHoldingsQuery } from "@/server/domain/portfolio-query";
import { PORTFOLIO_ROUTES } from "@/server/domain/portfolio-routes";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Portfolio · LAX Account" };

/** Your works from every LAX product. Read-only: each action opens the product that owns it. */
export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<PortfolioSearchParams>;
}) {
  const [params, loaded] = await Promise.all([searchParams, loadPortfolioItems()]);
  if (loaded.status === "unavailable")
    return <AccountUnavailable retryHref={PORTFOLIO_ROUTES.overview} />;
  if (loaded.status === "unsigned")
    redirect(`/api/auth/login?returnTo=${PORTFOLIO_ROUTES.overview}`);

  const filter = parseHoldingsQuery(params);
  const page = buildPortfolioPage(loaded.rows, filter, loaded.complete);
  const notices = buildSourceNotices(loaded, "items");
  const payHref = page.attention.find((row) => row.external)?.href ?? null;
  const isNewCollector = page.emptyState === "new_collector";

  return (
    <AccountShell width="wide">
      <AccountPageHeader title="Portfolio" backHref={ACCOUNT_ROUTES.overview} />
      <PortfolioNotices notices={notices} />
      {page.emptyState ? (
        <PortfolioEmptyState
          kind={page.emptyState}
          products={buildAccountProducts(getLaxAccountContainer().config)}
          payHref={payHref}
        />
      ) : null}
      {isNewCollector || loaded.rows.length === 0 ? null : (
        <>
          <PortfolioHeader header={page.header} />
          <PortfolioAttention rows={page.attention} />
          <PortfolioHoldings
            holdings={page.holdings}
            options={page.options}
            filter={filter}
            action={PORTFOLIO_ROUTES.overview}
          />
          <p className="text-sm">
            <a href={PORTFOLIO_ROUTES.money} className="underline">
              See your money across LAX
            </a>
          </p>
        </>
      )}
    </AccountShell>
  );
}
