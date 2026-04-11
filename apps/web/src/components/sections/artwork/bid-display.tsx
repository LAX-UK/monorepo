import { formatMoney } from "@/lib/format-currency";

type Props = {
  currentPrice: string;
  remainingLabel: string;
  live?: boolean;
};

export function BidDisplay({ currentPrice, remainingLabel, live }: Props) {
  return (
    <div className="mb-12 grid gap-8 sm:grid-cols-2">
      <div className="rounded-lg bg-surface-container-high/50 p-6 ring-1 ring-outline-variant/10">
        <span className="mb-2 block font-label text-[10px] uppercase tracking-widest text-secondary">
          Current high bid
        </span>
        <span className="font-headline text-4xl text-primary sm:text-5xl">
          {formatMoney(currentPrice)}
        </span>
      </div>
      <div className="rounded-lg bg-gradient-to-br from-primary-container/25 to-surface-container-high/80 p-6 ring-1 ring-primary/15">
        <div className="mb-2 flex items-center gap-2">
          {live ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
              </span>
              <span className="font-label text-[10px] font-bold uppercase tracking-widest text-error">
                Live
              </span>
            </>
          ) : (
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
              Schedule
            </span>
          )}
        </div>
        <span className="mb-2 block font-label text-[10px] uppercase tracking-widest text-secondary">
          Time remaining
        </span>
        <span className="font-headline tabular-nums text-3xl text-on-surface">{remainingLabel}</span>
      </div>
    </div>
  );
}
