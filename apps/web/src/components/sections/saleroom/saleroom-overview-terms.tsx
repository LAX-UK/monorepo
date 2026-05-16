import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
};

/** Collapsible full terms body. */
export function SaleroomOverviewTerms({ overview }: Props) {
  if (!overview.terms) return null;

  return (
    <details className="group mt-6 rounded border border-outline-variant/30 bg-surface-container-low/30 p-4 open:bg-surface-container-low/50 dark:bg-surface-container-low/30 dark:open:bg-surface-container/40">
      <summary className="cursor-pointer list-none text-lg font-semibold text-on-surface [&::-webkit-details-marker]:hidden">
        <span className="underline decoration-outline-variant/50 underline-offset-2 group-open:decoration-on-surface">
          Terms &amp; conditions
        </span>
      </summary>
      <div className="mt-4 whitespace-pre-wrap text-base leading-6 text-on-surface">
        {overview.terms}
      </div>
    </details>
  );
}
