import { SaleCalendarCountdown } from "@/components/sections/sales/sale-calendar-countdown";
import { LiveDot, cn } from "@auction/ui";

type Props = {
  countdownEndIso: string;
  className?: string;
};

/** Live pill for calendar cards (SRP). */
export function SaleLiveBadge({ countdownEndIso, className }: Props) {
  return (
    <div
      className={cn(
        "absolute bottom-3 left-3 flex min-h-8 items-center gap-1 rounded bg-scrim-hero-soft px-2",
        className,
      )}
      aria-label="Live auction, time remaining"
    >
      <LiveDot size="sm" className="shrink-0" />
      <span className="font-body text-sm font-semibold leading-4 text-cta-on">Live</span>
      <SaleCalendarCountdown endIso={countdownEndIso} className="text-cta-on" />
    </div>
  );
}
