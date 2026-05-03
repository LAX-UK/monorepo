import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
  /** When true, omit the “About this sale” copy (moved to hero). */
  hideDescription?: boolean;
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-sm uppercase leading-4 text-brand-400 dark:text-on-surface-variant">
        {label}
      </dt>
      <dd className="text-base leading-6 text-brand-500 dark:text-on-surface">{value}</dd>
    </div>
  );
}

/**
 * Read-only marketing overview: all salient `Sale` fields. Data via `SaleOverviewVM` (DIP).
 */
export function SaleroomOverviewPanel({ overview, hideDescription = false }: Props) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40">
        <h2 className="mb-4 text-xl font-semibold text-brand-900 dark:text-on-surface">
          Sale overview
        </h2>
        <dl className="grid grid-cols-1 gap-0">
          <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
            <Fact label="Starts" value={overview.startLabel} />
          </div>
          <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
            <Fact label="Ends" value={overview.endLabel} />
          </div>
          {overview.previewLabel ? (
            <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
              <Fact label="Preview" value={overview.previewLabel} />
            </div>
          ) : null}
          <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
            <Fact label="Format" value={overview.formatLabel} />
          </div>
          <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
            <Fact label="Buyer's premium" value={overview.buyerPremiumLabel} />
          </div>
          {overview.categoryLabel ? (
            <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
              <Fact label="Category" value={overview.categoryLabel} />
            </div>
          ) : null}
          <div className="flex justify-between gap-6 py-3">
            <Fact label="Lots" value={overview.lotsLabel} />
          </div>
        </dl>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-label text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
          <Link
            href="/faq"
            className="text-brand-900 underline-offset-4 hover:underline dark:text-on-surface"
          >
            How to bid
          </Link>
          <Link
            href="/shipping"
            className="text-brand-900 underline-offset-4 hover:underline dark:text-on-surface"
          >
            Shipping
          </Link>
        </p>
      </div>

      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40">
        <h2 className="mb-4 text-lg font-semibold text-brand-900 dark:text-on-surface">
          About this sale
        </h2>
        {hideDescription ? null : overview.description ? (
          <p className="whitespace-pre-wrap text-sm leading-7 text-brand-500 dark:text-on-surface-variant">
            {overview.description}
          </p>
        ) : (
          <p className="text-sm leading-7 text-brand-400 dark:text-on-surface-variant">
            No description has been provided.
          </p>
        )}

        {overview.tags.length > 0 ? (
          <div className="mt-6">
            <p className="mb-2 text-sm uppercase leading-4 text-brand-400 dark:text-on-surface-variant">
              Tags
            </p>
            <ul className="flex list-none flex-wrap gap-2 p-0">
              {overview.tags.map((t) => (
                <li
                  key={t}
                  className="inline-flex items-center rounded border border-brand-100 bg-transparent px-2.5 py-1 text-xs font-medium text-brand-500 dark:border-outline-variant/40 dark:text-on-surface"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {overview.showLocation ? (
          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold text-brand-900 dark:text-on-surface">
              Venue
            </h3>
            {overview.locationName ? (
              <p className="text-base leading-6 text-brand-500 dark:text-on-surface">
                {overview.locationName}
              </p>
            ) : null}
            {overview.locationAddressLines.length > 0 ? (
              <address className="mt-1 text-base not-italic leading-6 text-brand-500 dark:text-on-surface-variant">
                {overview.locationAddressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            ) : overview.locationAddress ? (
              <p className="mt-1 whitespace-pre-line text-base leading-6 text-brand-500 dark:text-on-surface-variant">
                {overview.locationAddress}
              </p>
            ) : null}
            {overview.resolvedMapUrl ? (
              <p className="mt-2 text-base">
                <a
                  href={overview.resolvedMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-brand-900 underline underline-offset-2 hover:opacity-80 dark:text-on-surface"
                >
                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                  {overview.locationMapUrl ? "Open map" : "Get directions"}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        {overview.showLiveStream && overview.streamUrl ? (
          <p className="mt-6 text-base">
            <a
              href={overview.streamUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-semibold text-brand-900 underline underline-offset-2 hover:opacity-80 dark:text-on-surface"
            >
              <ExternalLink className="size-4 shrink-0" aria-hidden />
              Watch live stream
            </a>
          </p>
        ) : null}

        {overview.terms ? (
          <details className="group mt-6 rounded border border-brand-100 bg-white/30 p-4 open:bg-white/50 dark:border-outline-variant/30 dark:bg-surface-container-low/30 dark:open:bg-surface-container/40">
            <summary className="cursor-pointer list-none text-lg font-semibold text-brand-900 [&::-webkit-details-marker]:hidden dark:text-on-surface">
              <span className="underline decoration-brand-100 underline-offset-2 group-open:decoration-brand-900 dark:decoration-outline-variant/50 dark:group-open:decoration-on-surface">
                Terms &amp; conditions
              </span>
            </summary>
            <div className="mt-4 whitespace-pre-wrap text-base leading-6 text-brand-500 dark:text-on-surface">
              {overview.terms}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
