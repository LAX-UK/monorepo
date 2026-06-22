import { DisplayHeading, LabelCaps } from "@auction/ui";
import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
  hideDescription?: boolean;
};

/** Long-form description + tag chips. Omits the block when there is nothing to show. */
export function SaleroomOverviewAbout({ overview, hideDescription = false }: Props) {
  const hasDescription = !hideDescription && Boolean(overview.description?.trim());
  const hasTags = overview.tags.length > 0;

  if (!hasDescription && !hasTags) {
    return null;
  }

  return (
    <>
      {hasDescription ? (
        <>
          <DisplayHeading as="h2" size="section" className="mb-4 font-semibold">
            About this sale
          </DisplayHeading>
          <p className="whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">
            {overview.description}
          </p>
        </>
      ) : hasTags ? (
        <DisplayHeading as="h2" size="section" className="mb-4 font-semibold">
          About this sale
        </DisplayHeading>
      ) : null}

      {hasTags ? (
        <div className={hasDescription ? "mt-6" : undefined}>
          <LabelCaps className="mb-2 text-on-surface-variant">Tags</LabelCaps>
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
