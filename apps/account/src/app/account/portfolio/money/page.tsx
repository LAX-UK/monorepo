import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { PortfolioMoney } from "@/components/portfolio-money";
import { PortfolioNotices } from "@/components/portfolio-notices";
import { loadMoneyEntries } from "@/server/application/load-portfolio-data";
import { buildSourceNotices } from "@/server/domain/portfolio-composition";
import { buildMoneyPage } from "@/server/domain/portfolio-money-page.vm";
import { type PortfolioSearchParams, parseMoneyQuery } from "@/server/domain/portfolio-query";
import { PORTFOLIO_ROUTES } from "@/server/domain/portfolio-routes";
import { EmptyState } from "@auction/ui/components/empty-state";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Money · LAX Account" };

/** What you have paid, owe and are owed, per business and currency. Read-only. */
export default async function PortfolioMoneyPage({
  searchParams,
}: {
  searchParams: Promise<PortfolioSearchParams>;
}) {
  const [params, loaded] = await Promise.all([searchParams, loadMoneyEntries()]);
  if (loaded.status === "unavailable")
    return <AccountUnavailable retryHref={PORTFOLIO_ROUTES.money} />;
  if (loaded.status === "unsigned") redirect(`/api/auth/login?returnTo=${PORTFOLIO_ROUTES.money}`);

  const filter = parseMoneyQuery(params);
  const page = buildMoneyPage(loaded.rows, filter, loaded.complete);

  return (
    <AccountShell width="wide">
      <AccountPageHeader
        title="Money"
        backHref={PORTFOLIO_ROUTES.overview}
        backLabel="Back to portfolio"
      />
      <PortfolioNotices notices={buildSourceNotices(loaded, "money")} />
      {page.showEmptyState ? (
        <EmptyState
          headingLevel="h2"
          title="No money to show yet"
          description="Payments, payouts and refunds from LAX Bid, LAX Shop and lax.art appear here."
        />
      ) : page.money.isEmpty ? null : (
        <PortfolioMoney
          vm={page.money}
          filter={filter}
          action={PORTFOLIO_ROUTES.money}
          currencies={page.currencies}
        />
      )}
    </AccountShell>
  );
}
