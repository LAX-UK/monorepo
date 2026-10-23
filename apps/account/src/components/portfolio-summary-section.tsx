import { loadPortfolioItems } from "@/server/application/load-portfolio-data";
import { buildPortfolioSummary } from "@/server/domain/portfolio-summary.vm";
import { PortfolioSummaryCard } from "./portfolio-overview-cards";

/**
 * Reads the portfolio on its own so the overview can stream the rest of the page first; the
 * products may take several seconds to answer. A signed-out or unreachable session shows the
 * same quiet fallback, because the page around it has already handled sign-in.
 */
export async function PortfolioSummarySection() {
  const loaded = await loadPortfolioItems();
  const summary =
    loaded.status === "ok" ? buildPortfolioSummary(loaded) : ({ kind: "unavailable" } as const);
  return <PortfolioSummaryCard summary={summary} />;
}
