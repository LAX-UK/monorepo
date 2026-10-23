import { PORTFOLIO_ROUTES } from "@/server/domain/portfolio-routes";
import type { PortfolioSummaryVm } from "@/server/domain/portfolio-summary.vm";
import { Button } from "@auction/ui/components/button";

const CARD = "flex flex-col gap-3 rounded-2xl border border-border-hairline bg-surface p-4 sm:p-5";

function SummaryBody({ summary }: { summary: PortfolioSummaryVm }) {
  if (summary.kind === "empty") {
    return (
      <p className="text-sm text-on-surface-variant">
        Works you buy on LAX Bid, LAX Shop or lax.art appear here.
      </p>
    );
  }
  if (summary.kind === "unavailable") {
    return (
      <p className="text-sm text-on-surface-variant">
        We can't show your works right now. Please try again in a moment.
      </p>
    );
  }
  return (
    <>
      <p className="text-sm text-on-surface">{summary.counts.join(" · ")}</p>
      {summary.incompleteNote ? (
        <p className="text-xs text-on-surface-variant">{summary.incompleteNote}</p>
      ) : null}
    </>
  );
}

/** The works you own across LAX at a glance, with the way into the full portfolio. */
export function PortfolioSummaryCard({ summary }: { summary: PortfolioSummaryVm }) {
  return (
    <section aria-labelledby="portfolio-card-heading" className={CARD}>
      <h2 id="portfolio-card-heading" className="font-headline text-lg font-semibold">
        Portfolio
      </h2>
      <SummaryBody summary={summary} />
      <Button asChild variant="outline" size="sm" className="min-h-11 self-start">
        <a href={PORTFOLIO_ROUTES.overview}>View portfolio</a>
      </Button>
    </section>
  );
}

/** Shown while the portfolio is read from the products, so the rest of the overview is not held up. */
export function PortfolioSummaryCardSkeleton() {
  return (
    <section aria-busy="true" aria-label="Portfolio" className={CARD}>
      <div className="h-6 w-28 rounded bg-surface-container motion-safe:animate-pulse" />
      <div className="h-4 w-56 rounded bg-surface-container motion-safe:animate-pulse" />
      <div className="h-11 w-36 rounded-lg bg-surface-container motion-safe:animate-pulse" />
    </section>
  );
}

/**
 * Organisations belong to LAX Bid, which lists them with each member's role. Account links
 * there rather than repeating the list: Bid's organisation routes do not accept Account's
 * read-only portfolio token, so a list here would need a new scope or endpoint first.
 */
export function OrganisationsCard({ href }: { href: string }) {
  return (
    <section aria-labelledby="organisations-card-heading" className={CARD}>
      <h2 id="organisations-card-heading" className="font-headline text-lg font-semibold">
        Your organisations
      </h2>
      <p className="text-sm text-on-surface-variant">
        Galleries and businesses you belong to are managed in LAX Bid, where you can see your role
        in each.
      </p>
      <Button asChild variant="outline" size="sm" className="min-h-11 self-start">
        <a href={href}>Open in Bid</a>
      </Button>
    </section>
  );
}
