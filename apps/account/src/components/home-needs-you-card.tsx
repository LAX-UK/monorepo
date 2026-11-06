import { Button } from "@/components/account-button";
import type { NeedsYouLineVm, NeedsYouVm } from "@/server/domain/home-needs-you.vm";
import { PORTFOLIO_ROUTES } from "@/server/domain/portfolio-routes";
import { MarketingViewAllChevron } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { CARD, CARD_ROW_PADDING, CardHeader } from "./account-ui";
import { ProductText } from "./product-name";

/** Where the keyboard ring lands: inside the row, so the card's rounded edge never clips it. */
const ROW_LINK =
  "block text-sm font-medium text-on-surface after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring";

function chevronClass(action: NeedsYouLineVm["action"]): string {
  if (!action) return "";
  // A visible button already says "open"; a button hidden on a phone leaves the chevron there.
  return action.onPhone ? "hidden" : "sm:hidden";
}

function NeedsYouLine({ line }: { line: NeedsYouLineVm }) {
  const { action } = line;
  return (
    <li
      className={cn(
        "relative flex min-h-16 items-center gap-3 py-2.5 transition-colors hover:bg-surface-container-low active:bg-surface-container",
        CARD_ROW_PADDING,
      )}
    >
      <div className="min-w-0 flex-1">
        <a href={line.href} className={ROW_LINK}>
          {line.title}
        </a>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          <ProductText text={line.meta} />
        </p>
      </div>
      {action ? (
        <Button
          asChild
          variant={action.primary ? "cta" : "outline"}
          className={cn("relative z-10 shrink-0", !action.onPhone && "hidden sm:inline-flex")}
        >
          <a href={line.href}>
            {/* Each label is removed from the page (not just hidden) at the other breakpoint. */}
            <span className="sm:hidden">{action.shortLabel}</span>
            <span className="max-sm:hidden">{action.label}</span>
          </a>
        </Button>
      ) : null}
      <MarketingViewAllChevron
        className={cn("size-4 shrink-0 text-on-surface-variant", chevronClass(action))}
      />
    </li>
  );
}

/**
 * What needs the person, from every product: payments first, at most three lines and the rest
 * as a count. Nothing to do collapses to one calm line rather than an empty card.
 */
export function NeedsYouCard({ needsYou }: { needsYou: NeedsYouVm }) {
  if (needsYou.lines.length === 0) {
    return (
      <section aria-labelledby="needs-you-heading" className={cn(CARD, "px-4 py-4 sm:px-5")}>
        <h2 id="needs-you-heading" className="sr-only">
          Needs you
        </h2>
        <p className="text-sm text-on-surface-variant">Nothing needs you right now.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="needs-you-heading" className={`overflow-hidden ${CARD}`}>
      <CardHeader
        id="needs-you-heading"
        title="Needs you"
        linkHref={PORTFOLIO_ROUTES.overview}
        linkLabel="See all in Portfolio"
      />
      <ul className="divide-y divide-border-hairline border-t border-border-hairline">
        {needsYou.lines.map((line) => (
          <NeedsYouLine key={line.key} line={line} />
        ))}
      </ul>
      {needsYou.moreCount > 0 ? (
        <a
          href={PORTFOLIO_ROUTES.overview}
          className={cn(
            "flex min-h-11 items-center border-t border-border-hairline text-sm font-medium text-on-surface underline underline-offset-[3px] hover:bg-surface-container-low",
            CARD_ROW_PADDING,
          )}
        >
          {needsYou.moreCount} more
        </a>
      ) : null}
    </section>
  );
}

/** The final shape of the card while the products answer: a header and three row bars. */
export function NeedsYouCardSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading what needs you"
      className={`overflow-hidden ${CARD}`}
    >
      <div className="h-5 w-24 rounded bg-surface-container motion-safe:animate-pulse m-4 sm:mx-5" />
      <ul className="divide-y divide-border-hairline border-t border-border-hairline">
        {[0, 1, 2].map((row) => (
          <li key={row} className={cn("flex min-h-16 items-center gap-3 py-2.5", CARD_ROW_PADDING)}>
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-2/3 rounded bg-surface-container motion-safe:animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-surface-container motion-safe:animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
