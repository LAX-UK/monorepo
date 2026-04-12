import { formatMoney } from "@/lib/format-currency";
import Link from "next/link";

type Props = {
  currentPrice: string;
  remainingLabel: string;
  minNextBid: string;
  /** Human-readable local end time, e.g. for timezone clarity. */
  saleEndLocalLabel: string;
  live?: boolean;
};

export function BidDisplay({
  currentPrice,
  remainingLabel,
  minNextBid,
  saleEndLocalLabel,
  live,
}: Props) {
  return (
    <div className="mb-12 space-y-6">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-container-high/50 p-6 ring-1 ring-outline-variant/10">
          <span className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary">
            Current high bid
          </span>
          <span className="font-headline text-4xl text-primary sm:text-5xl">
            {formatMoney(currentPrice)}
          </span>
          <p className="mt-3 font-body text-sm text-on-surface-variant">
            Minimum next bid{" "}
            <span className="font-headline tabular-nums text-on-surface">
              {formatMoney(minNextBid)}
            </span>
          </p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-primary-container/25 to-surface-container-high/80 p-6 ring-1 ring-primary/15">
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
          <span className="font-headline tabular-nums text-3xl text-on-surface">
            {remainingLabel}
          </span>
          <p className="mt-3 font-body text-xs leading-relaxed text-on-surface-variant">
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
