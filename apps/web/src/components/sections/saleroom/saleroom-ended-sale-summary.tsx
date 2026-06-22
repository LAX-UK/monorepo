import type { EndedSaleSummaryVM } from "./view-models";

type Props = {
  summary: EndedSaleSummaryVM;
};

/** Post-sale results band for ended sales when full catalogue is loaded. */
export function SaleroomEndedSaleSummary({ summary }: Props) {
  return (
    <section
      aria-labelledby="ended-sale-summary-title"
      className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40"
    >
      <h2
        id="ended-sale-summary-title"
        className="mb-4 font-headline text-[length:var(--text-title-section)] font-semibold text-on-surface"
      >
        Sale results
      </h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            Sold
          </dt>
          <dd className="mt-1 font-headline text-xl font-semibold text-on-surface">
            {summary.soldCount}
          </dd>
        </div>
        <div>
          <dt className="font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            Unsold
          </dt>
          <dd className="mt-1 font-headline text-xl font-semibold text-on-surface">
            {summary.unsoldCount}
          </dd>
        </div>
        <div>
          <dt className="font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            Hammer total
          </dt>
          <dd className="mt-1 font-headline text-xl font-semibold text-on-surface">
            {summary.hammerTotalLabel}
          </dd>
        </div>
      </dl>
      {summary.partialLabel ? (
        <p className="mt-3 text-sm text-on-surface-variant">{summary.partialLabel}</p>
      ) : null}
    </section>
  );
}
