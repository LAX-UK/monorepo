"use client";

import {
  MarketingCountdownPanel,
  formatCountdownSecondaryLine,
} from "@/components/marketing/marketing-countdown-panel";
import { resolveHeroCountdownEnd } from "@/components/sections/saleroom/hero/saleroom-hero-copy";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";

type Props = {
  hero: SaleHeroVM;
};

function TimingLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="font-body text-base text-on-surface">
      <span className="text-on-surface-variant">{label}: </span>
      {value}
    </p>
  );
}

export function SaleroomHeroTimingBlock({ hero }: Props) {
  const countdownEnd = resolveHeroCountdownEnd(hero);
  const hasRelativeLines =
    (hero.leftColumnLabel != null && hero.registrationClosesShort != null) ||
    (hero.rightColumnLabel != null && hero.biddingStartsShort != null) ||
    countdownEnd != null;

  if (!hasRelativeLines) return null;

  const isActive = hero.status === "active";
  const countdownLabel = isActive ? "Closes in" : "Opens in";
  const secondaryLine = isActive
    ? formatCountdownSecondaryLine("Ends", hero.endTime)
    : formatCountdownSecondaryLine("Starts", hero.startTime);

  return (
    <fieldset className="fade-up-d3 m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="sr-only">Sale schedule</legend>
      {hero.leftColumnLabel != null && hero.registrationClosesShort != null ? (
        <TimingLine label={hero.leftColumnLabel} value={hero.registrationClosesShort} />
      ) : null}
      {hero.rightColumnLabel != null && hero.biddingStartsShort != null ? (
        <TimingLine label={hero.rightColumnLabel} value={hero.biddingStartsShort} />
      ) : null}
      {countdownEnd ? (
        <MarketingCountdownPanel
          label={countdownLabel}
          endIso={countdownEnd}
          showLiveDot={isActive}
          secondaryLine={secondaryLine}
          className="pt-1"
        />
      ) : null}
    </fieldset>
  );
}
