import type { CollectionVm } from "@/server/domain/collection.vm";
import type { WorksByProductVm } from "@/server/domain/works-by-product.vm";
import { cn } from "@auction/ui";
import { CARD, CARD_ROW_PADDING, CardHeader, FIGURE_LARGE, FIGURE_MEDIUM } from "./account-ui";
import { WorksByProduct } from "./works-by-product";

function MoneyLine({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-sm text-on-surface-variant">{label}</dt>
        <dd className={FIGURE_MEDIUM}>{value}</dd>
      </div>
      {note ? <dd className="text-xs text-on-surface-variant">{note}</dd> : null}
    </div>
  );
}

/**
 * The collection at a glance, on Home and at the top of Portfolio: up to three counts, what is
 * due and what has been paid, and the works by product. Zero figures are not shown; an incomplete
 * read says so. Home links to Portfolio from the header and keeps the money lines short;
 * Portfolio has no link (it is the page) and explains each money line.
 */
export function CollectionCard({
  collection,
  chart,
  incompleteNote,
  link,
  showNotes = false,
}: {
  collection: CollectionVm;
  chart: WorksByProductVm | null;
  incompleteNote: string | null;
  /** The one text link in the header; omitted where the card already sits on its destination. */
  link?: { href: string; label: string };
  /** Explain the money lines under each figure. */
  showNotes?: boolean;
}) {
  return (
    <section aria-labelledby="collection-heading" className={`overflow-hidden ${CARD}`}>
      <CardHeader
        id="collection-heading"
        title="Your collection"
        {...(link ? { linkHref: link.href, linkLabel: link.label } : {})}
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
              <MoneyLine
                label="Total due"
                value={collection.totalDue}
                note={showNotes ? collection.totalDueNote : null}
              />
            ) : null}
            {collection.paidSoFar ? (
              <MoneyLine
                label="Paid so far"
                value={collection.paidSoFar}
                note={showNotes ? collection.paidSoFarNote : null}
              />
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
