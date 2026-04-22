import {
  type CountdownTier,
  countdownTier,
  formatCountdownAriaLabel,
} from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import { Separator, cn } from "@auction/ui";

type Props = {
  estimateLine: string | null;
  currentPrice: string;
  bidCount: number;
  /** When set, show reserve met / not met next to the current-bid label. */
  reservePrice: string | null;
  closingLabel: string;
  /** Remaining time until close (for urgency + a11y). */
  msRemaining: number;
  /** e.g. "Apr 22, 2025, 4:00 PM" */
  saleEndLocalLabel: string;
  /** ISO-8601 instant of scheduled close (for `<time dateTime>`). */
  endAtIso: string;
};

/**
 * Figma: three bordered rows — Estimate, Current bid (N bids), Closing.
 */
export function LotInfoStack({
  estimateLine,
  currentPrice,
  bidCount,
  reservePrice,
  closingLabel,
  msRemaining,
  saleEndLocalLabel,
  endAtIso,
}: Props) {
  const tier = countdownTier(msRemaining);
  const hasReserve = reservePrice != null && reservePrice !== "";
  const reserveMet = hasReserve
    ? Number.parseFloat(currentPrice) + 1e-9 >= Number.parseFloat(reservePrice ?? "0")
    : null;

  return (
    <div className="w-full max-w-[550px]">
      <InfoRow label="Estimate" value={estimateLine ?? "—"} valueClass="text-xl font-medium" />
      <Separator className="bg-outline-variant dark:bg-outline-variant" />
      <div className="flex flex-col justify-center gap-2.5 py-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-base leading-4 text-on-surface dark:text-brand-500">
            Current bid ({bidCount} {bidCount === 1 ? "bid" : "bids"})
          </span>
          {hasReserve && reserveMet !== null ? (
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wide",
                reserveMet
                  ? "bg-primary-container/40 text-primary"
                  : "bg-surface-container-high text-on-surface-variant",
              )}
            >
              {reserveMet ? "Reserve met" : "Reserve not met"}
            </span>
          ) : null}
        </div>
        <span
          aria-live="polite"
          className="text-xl font-medium tabular-nums leading-4 text-on-surface dark:text-brand-500"
        >
          {formatMoney(currentPrice)}
        </span>
      </div>
      <Separator className="bg-outline-variant dark:bg-outline-variant" />
      <ClosingRow
        label="Closing"
        value={closingLabel}
        msRemaining={msRemaining}
        saleEndLocalLabel={saleEndLocalLabel}
        endAtIso={endAtIso}
        tier={tier}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col justify-center gap-2.5 py-4">
      <span className="text-base leading-4 text-on-surface dark:text-brand-500">{label}</span>
      <span
        className={cn(
          "tabular-nums leading-4 text-on-surface dark:text-brand-500",
          valueClass ?? "",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ClosingRow({
  label,
  value,
  msRemaining,
  saleEndLocalLabel,
  endAtIso,
  tier,
}: {
  label: string;
  value: string;
  msRemaining: number;
  saleEndLocalLabel: string;
  endAtIso: string;
  tier: CountdownTier;
}) {
  const urgent = tier === "urgent" || tier === "critical";
  const rowHighlight = tier === "critical";

  return (
    <div
      className={cn(
        "flex flex-col justify-center gap-2 py-4",
        rowHighlight && "rounded-md bg-error-container/20 px-2 -mx-1",
      )}
    >
      <span className="text-base leading-4 text-on-surface dark:text-brand-500">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        {urgent ? (
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-error" aria-hidden />
        ) : null}
        <time
          dateTime={endAtIso}
          aria-label={formatCountdownAriaLabel(msRemaining)}
          className={cn(
            "min-w-0 text-xl font-medium tabular-nums leading-5 text-on-surface dark:text-brand-500",
            urgent && "text-error",
          )}
        >
          {value}
        </time>
      </div>
      <p className="text-xs leading-snug text-on-surface-variant">Closes {saleEndLocalLabel}</p>
    </div>
  );
}
