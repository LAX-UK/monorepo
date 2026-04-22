import type { SaleHeroVM } from "./view-models";

type StatusLinesProps = {
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

/**
 * Right-column registration / bidding short rows only (Figma: 16px gap between rows).
 */
export function SaleroomHeroStatusLines({ hero }: StatusLinesProps) {
  const hasStatusRows = Boolean(hero.registrationClosesShort || hero.biddingStartsShort);

  if (!hasStatusRows) return null;

  return (
    <div className="flex w-full flex-col gap-4 lg:items-end">
      {hero.registrationClosesShort ? (
        <p className="text-base leading-4 text-brand-500 dark:text-on-surface-variant">
          <span>Registration Closes: </span>
          <span>{hero.registrationClosesShort}</span>
        </p>
      ) : null}
      {hero.biddingStartsShort ? (
        <p className="text-base leading-4 text-brand-500 dark:text-on-surface-variant">
          <span>Bidding Starts: </span>
          <span>{hero.biddingStartsShort}</span>
        </p>
      ) : null}
    </div>
  );
}
