import { formatMoney } from "@/lib/format-currency";
import Link from "next/link";

type Props = {
  currentPrice: string;
  remainingLabel: string;
  /** Milliseconds until end (can be negative when ended). */
  msRemaining: number;
  minNextBid: string;
  /** Human-readable local end time, e.g. for timezone clarity. */
  saleEndLocalLabel: string;
  live?: boolean;
  /** Logged-in user currently holds the winning bid. */
  isWinning?: boolean;
  /** Brief CSS animation on the price when it changes. */
  priceFlash?: boolean;
};

function countdownUrgencyClass(ms: number): string {
  if (ms <= 0) return "text-on-surface-variant";
  if (ms <= 5 * 60 * 1000) {
    return "text-error motion-safe:animate-pulse";
  }
  if (ms <= 60 * 60 * 1000) {
    return "text-[color:var(--color-tertiary,#b45309)] dark:text-orange-300";
  }
  return "text-on-surface";
}

export function BidDisplay({
  currentPrice,
  remainingLabel,
  msRemaining,
  minNextBid,
  saleEndLocalLabel,
  live,
  isWinning,
  priceFlash,
}: Props) {
  const timerClass = countdownUrgencyClass(msRemaining);

  return (
    <div className="mb-12 space-y-6">
      {isWinning ? (
        <output
          className="block rounded-lg border border-primary/35 bg-primary-container/15 px-4 py-3 font-body text-sm text-on-surface ring-1 ring-primary/25"
          aria-live="polite"
        >
          <span className="font-label text-xs font-bold uppercase tracking-widest text-primary">
            You&apos;re winning
          </span>
          <p className="mt-1 text-on-surface">Your bid is currently the high bid on this lot.</p>
        </output>
      ) : null}

      <div className="flex min-w-0 flex-col gap-6">
        <div className="min-w-0 overflow-hidden rounded-lg bg-surface-container-high/50 p-6 ring-1 ring-outline-variant/10">
          <span className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary">
            Current high bid
          </span>
          <span
            aria-live="polite"
            aria-atomic="true"
            className={`block max-w-full font-headline text-3xl leading-tight tracking-tight text-primary [overflow-wrap:anywhere] min-[400px]:text-4xl lg:text-5xl motion-reduce:transition-none ${
              priceFlash
                ? "motion-safe:animate-[bidPriceBump_0.45s_ease-out]"
                : "transition-transform duration-300"
            }`}
          >
            {formatMoney(currentPrice)}
          </span>
          <p className="mt-3 break-words font-body text-sm text-on-surface-variant">
            Minimum next bid{" "}
            <span className="font-headline tabular-nums text-on-surface">
              {formatMoney(minNextBid)}
            </span>
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded-lg bg-gradient-to-br from-primary-container/25 to-surface-container-high/80 p-6 ring-1 ring-primary/15">
          <div className="mb-2 flex items-center gap-2">
            {live ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
                </span>
                <span className="font-label text-xs font-bold uppercase tracking-widest text-error">
                  Live
                </span>
              </>
            ) : (
              <span className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
                Schedule
              </span>
            )}
          </div>
          <span className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary">
            Time remaining
          </span>
          <span
            className={`block max-w-full break-words font-headline tabular-nums text-3xl min-[400px]:text-4xl ${timerClass}`}
          >
            {remainingLabel}
          </span>
          <p className="mt-3 break-words font-body text-xs leading-relaxed text-on-surface-variant">
            {saleEndLocalLabel}. Timer uses your device&apos;s local time.
          </p>
        </div>
      </div>
      <p className="rounded-md bg-surface-container-high/40 px-4 py-3 font-body text-xs leading-relaxed text-on-surface-variant ring-1 ring-outline-variant/10">
        Hammer price plus buyer&apos;s premium (shown at checkout). Shipping is quoted after
        payment; see{" "}
        <Link href="/shipping" className="text-primary underline-offset-2 hover:underline">
          shipping
        </Link>
        .
      </p>
    </div>
  );
}
