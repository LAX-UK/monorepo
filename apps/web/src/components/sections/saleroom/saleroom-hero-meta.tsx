import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
};

/** Figma live dot: outer ~20px at 5% red, inner 10px at 78% red. */
export function LiveIndicator() {
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
      <span className="absolute size-[19.5px] rounded-full bg-[#FF0000]/5" />
      <span className="absolute size-2.5 rounded-full bg-[#FF0000]/[0.78]" />
    </span>
  );
}

/** Figma right column: “Overview”, description, format line, bordered two-column preview/bidding row.
 */
export function SaleroomHeroOverview({ hero }: Props) {
  const hasLeft = Boolean(hero.leftColumnLabel && hero.registrationClosesShort);
  const hasRight = Boolean(hero.rightColumnLabel && hero.biddingStartsShort);
  const showBorderedRow = hasLeft || hasRight;
  const hasDescription = Boolean(hero.description?.trim());
  const hasMeta = Boolean(hero.overviewMetaLine);

  if (!hasDescription && !hasMeta && !showBorderedRow) return null;

  return (
    <div className="flex w-full flex-col gap-4 text-left lg:max-w-[520px]">
      <h2 className="font-['DM_Sans',sans-serif] text-lg font-semibold uppercase leading-[21px] text-brand-900 dark:text-on-surface">
        Overview
      </h2>
      {hasDescription ? (
        <p className="whitespace-pre-wrap text-base leading-6 text-brand-500 dark:text-on-surface">
          {hero.description}
        </p>
      ) : null}
      {hasMeta ? (
        <p className="text-sm leading-5 text-brand-400 dark:text-on-surface-variant">
          {hero.overviewMetaLine}
        </p>
      ) : null}
      {showBorderedRow ? (
        <div className="grid w-full grid-cols-1 gap-4 border border-brand-100 p-4 sm:grid-cols-2 dark:border-outline-variant/30">
          <div className="flex min-w-0 flex-col gap-1">
            {hasLeft ? (
              <>
                <span className="text-sm uppercase leading-4 text-brand-400 dark:text-on-surface-variant">
                  {hero.leftColumnLabel}
                </span>
                <span className="text-base font-semibold leading-6 text-brand-900 dark:text-on-surface">
                  {hero.registrationClosesShort}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            {hasRight ? (
              <>
                <span className="text-sm uppercase leading-4 text-brand-400 dark:text-on-surface-variant">
                  {hero.rightColumnLabel}
                </span>
                <span className="text-base font-semibold leading-6 text-brand-900 dark:text-on-surface">
                  {hero.biddingStartsShort}
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
