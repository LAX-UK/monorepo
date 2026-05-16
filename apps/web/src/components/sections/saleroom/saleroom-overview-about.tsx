import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
  hideDescription?: boolean;
};

/** Long-form description + tag chips. */
export function SaleroomOverviewAbout({ overview, hideDescription = false }: Props) {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold text-on-surface">About this sale</h2>
      {hideDescription ? null : overview.description ? (
        <p className="whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">
          {overview.description}
        </p>
      ) : (
        <p className="text-sm leading-7 text-on-surface-variant">
          No description has been provided.
        </p>
      )}

      {overview.tags.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-sm uppercase leading-4 text-on-surface-variant">Tags</p>
          <ul className="flex list-none flex-wrap gap-2 p-0">
            {overview.tags.map((t) => (
              <li
                key={t}
                className="inline-flex items-center rounded border border-outline-variant/40 bg-transparent px-2.5 py-1 text-xs font-medium text-on-surface"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
