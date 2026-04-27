import { ExternalLink } from "lucide-react";
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
    <div className="mx-auto w-full max-w-[960px]">
      {hideDescription ? null : overview.description ? (
        <div className="mb-10">
          <h2 className="mb-3 text-lg font-semibold text-brand-900 dark:text-on-surface">
            About this sale
          </h2>
          <p className="whitespace-pre-wrap text-base leading-6 text-brand-500 dark:text-on-surface">
            {overview.description}
          </p>
        </div>
      ) : (
        <p className="mb-10 text-base leading-6 text-brand-400 dark:text-on-surface-variant">
          No description has been provided.
        </p>
      )}

      <h2 className="mb-6 text-lg font-semibold text-brand-900 dark:text-on-surface">
        Key details
      </h2>
      <dl className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Fact label="Starts" value={overview.startLabel} />
        <Fact label="Ends" value={overview.endLabel} />
        {overview.previewLabel ? <Fact label="Preview" value={overview.previewLabel} /> : null}
        <Fact label="Format" value={overview.formatLabel} />
        <Fact label="Buyer's premium" value={overview.buyerPremiumLabel} />
        {overview.categoryLabel ? <Fact label="Category" value={overview.categoryLabel} /> : null}
        <Fact label="Lots" value={overview.lotsLabel} />
      </dl>

      {overview.tags.length > 0 ? (
        <div className="mb-10">
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
        <div className="mb-10">
          <h3 className="mb-3 text-lg font-semibold text-brand-900 dark:text-on-surface">Venue</h3>
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
        <p className="mb-10 text-base">
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
        <details className="group rounded border border-brand-100 bg-white/30 p-4 open:bg-white/50 dark:border-outline-variant/30 dark:bg-surface-container-low/30 dark:open:bg-surface-container/40">
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
  );
}
