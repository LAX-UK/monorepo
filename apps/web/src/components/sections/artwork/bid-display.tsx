import { formatMoney } from "@/lib/format-currency";

type Props = {
  currentPrice: string;
  remainingLabel: string;
};

export function BidDisplay({ currentPrice, remainingLabel }: Props) {
  return (
    <div className="mb-12 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="mb-2 block font-label text-[10px] uppercase tracking-widest text-secondary">
          Current high bid
        </span>
        <span className="font-headline text-4xl text-primary sm:text-5xl">
          {formatMoney(currentPrice)}
        </span>
      </div>
      <div className="text-left sm:text-right">
        <span className="mb-2 block font-label text-[10px] uppercase tracking-widest text-secondary">
          Time remaining
        </span>
        <span className="font-headline tabular-nums text-2xl text-on-surface">{remainingLabel}</span>
      </div>
    </div>
  );
}
