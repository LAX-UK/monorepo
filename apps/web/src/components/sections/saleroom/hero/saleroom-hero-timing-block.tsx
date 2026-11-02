"use client";

import { MarketingCountdownPanel } from "@/components/marketing/marketing-countdown-panel";
import { resolveHeroCountdownEnd } from "@/components/sections/saleroom/hero/saleroom-hero-copy";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import { formatLondonDateTime } from "@/lib/datetime/london-time";
import { opensLine } from "@/lib/time/opens-line";
import { useClientClock } from "@/lib/time/use-client-clock";

type Props = {
  hero: SaleHeroVM;
};

/** When the preview opens, by the time rule; the date until the clock is known. */
function PreviewLine({ iso }: { iso: string }) {
  const nowMs = useClientClock(60_000);
  const target = new Date(iso);
  const line =
    nowMs != null
      ? opensLine(target, new Date(nowMs), "Preview opens")
      : { label: "Preview opens", value: formatLondonDateTime(target) };
  return (
    <p className="font-body text-base text-on-surface">
      <span className="text-on-surface-variant">{line.label} </span>
      <span className="tabular-nums" suppressHydrationWarning>
        {line.value}
      </span>
    </p>
  );
}

export function SaleroomHeroTimingBlock({ hero }: Props) {
  const countdownEnd = resolveHeroCountdownEnd(hero);
  const hasRelativeLines = hero.previewOpensIso != null || countdownEnd != null;

  if (!hasRelativeLines) return null;

  const isActive = hero.status === "active";
  const countdownLabel = isActive ? "Closes in" : "Opens in";

  return (
    <fieldset className="fade-up-d3 m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="sr-only">Sale schedule</legend>
      {hero.previewOpensIso ? <PreviewLine iso={hero.previewOpensIso} /> : null}
      {countdownEnd ? (
        <MarketingCountdownPanel
          label={countdownLabel}
          endIso={countdownEnd}
          showLiveDot={isActive}
          className="pt-1"
          status={hero.status}
          deliveryMode={hero.deliveryMode}
          endTime={hero.endTime ?? countdownEnd}
        />
      ) : null}
    </fieldset>
  );
}
