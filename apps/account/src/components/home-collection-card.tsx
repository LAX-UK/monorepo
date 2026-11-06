import type { CollectionVm } from "@/server/domain/home-collection.vm";
import type { WorksByProductVm } from "@/server/domain/home-works-by-product.vm";
import { PORTFOLIO_ROUTES } from "@/server/domain/portfolio-routes";
import { cn } from "@auction/ui";
import { CARD, CARD_ROW_PADDING, CardHeader, FIGURE_LARGE, FIGURE_MEDIUM } from "./account-ui";
import { WorksByProduct } from "./home-works-by-product";

function MoneyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-on-surface-variant">{label}</dt>
      <dd className={FIGURE_MEDIUM}>{value}</dd>
    </div>
  );
}

/**
 * The collection at a glance: up to three counts, what is due and what has been paid, and the
 * works by product. Zero figures are not shown; an incomplete read says so.
 */
export function CollectionCard({
  collection,
  chart,
  incompleteNote,
}: {
  collection: CollectionVm;
  chart: WorksByProductVm | null;
  incompleteNote: string | null;
}) {
  return (
    <section aria-labelledby="collection-heading" className={`overflow-hidden ${CARD}`}>
      <CardHeader
        id="collection-heading"
        title="Your collection"
        linkHref={PORTFOLIO_ROUTES.overview}
        linkLabel="View portfolio"
      />
      <div
        className={cn("flex flex-col gap-5 border-t border-border-hairline py-5", CARD_ROW_PADDING)}
      >
        <dl className="grid grid-cols-3 gap-3">
          {collection.counts.map((count) => (
            <div key={count.key} className="flex flex-col-reverse justify-end gap-1">
              <dt className="text-xs leading-4 text-on-surface-variant">
                <span className="sm:hidden">{count.shortLabel}</span>
                <span className="max-sm:hidden">{count.label}</span>
              </dt>
              <dd className={FIGURE_LARGE}>{count.value}</dd>
            </div>
          ))}
        </dl>
        {collection.totalDue || collection.paidSoFar ? (
          <dl className="flex flex-col gap-2 border-t border-border-hairline pt-4">
            {collection.totalDue ? (
              <MoneyLine label="Total due" value={collection.totalDue} />
            ) : null}
            {collection.paidSoFar ? (
              <MoneyLine label="Paid so far" value={collection.paidSoFar} />
            ) : null}
          </dl>
        ) : null}
        {chart ? (
          <div className="border-t border-border-hairline pt-4">
            <WorksByProduct chart={chart} />
          </div>
        ) : null}
        {incompleteNote ? (
          <p className="text-xs text-on-surface-variant">{incompleteNote}</p>
        ) : null}
      </div>
    </section>
  );
}

/** The final shape of the card while the products answer: three counts and two money lines. */
export function CollectionCardSkeleton() {
  const bar = "rounded bg-surface-container motion-safe:animate-pulse";
  return (
    <section
      aria-busy="true"
      aria-label="Loading your collection"
      className={`overflow-hidden ${CARD}`}
    >
      <div className={`${bar} m-4 h-5 w-32 sm:mx-5`} />
      <div
        className={cn("flex flex-col gap-5 border-t border-border-hairline py-5", CARD_ROW_PADDING)}
      >
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((cell) => (
            <div key={cell} className="flex flex-col gap-2">
              <div className={`${bar} h-9 w-10`} />
              <div className={`${bar} h-3 w-16`} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-border-hairline pt-4">
          <div className={`${bar} h-5 w-full`} />
          <div className={`${bar} h-5 w-full`} />
        </div>
      </div>
    </section>
  );
}
