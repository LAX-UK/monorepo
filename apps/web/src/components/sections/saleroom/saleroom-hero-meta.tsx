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

/**
 * Date line, live label, title, registration / bidding short rows.
 * SRP: copy + layout for the left column of the right hero panel.
 */
export function SaleroomHeroMeta({ hero }: Props) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-base uppercase leading-4 text-[#191919]">{hero.dateLine}</p>
        {hero.isLive ? (
          <span className="inline-flex items-center gap-2.5">
            <LiveIndicator />
            <span className="text-base leading-4 text-[#191919]">{hero.liveLabel}</span>
          </span>
        ) : null}
      </div>
      <h1 className="text-2xl font-semibold leading-6 text-[#050505]">{hero.title}</h1>
      {hero.registrationClosesShort ? (
        <p className="text-base leading-4 text-[#191919]">
          <span>Registration Closes: </span>
          <span>{hero.registrationClosesShort}</span>
        </p>
      ) : null}
      {hero.biddingStartsShort ? (
        <p className="text-base leading-4 text-[#191919]">
          <span>Bidding Starts: </span>
          <span>{hero.biddingStartsShort}</span>
        </p>
      ) : null}
    </div>
  );
}
