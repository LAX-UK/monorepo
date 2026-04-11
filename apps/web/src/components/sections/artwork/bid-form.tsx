import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { formatMoney } from "@/lib/format-currency";

type Props = {
  minNumeric: number;
  amount: string;
  maxAuto: string;
  onAmountChange: (value: string) => void;
  onMaxAutoChange: (value: string) => void;
  onReview: () => void;
  onUseMinimum: () => void;
  error: string | null;
};

const CHIP_ADDS = [500, 1000, 5000] as const;

export function BidForm({
  minNumeric,
  amount,
  maxAuto,
  onAmountChange,
  onMaxAutoChange,
  onReview,
  onUseMinimum,
  error,
}: Props) {
  const minStr = minNumeric.toFixed(2);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          Quick bid
        </span>
        <button
          type="button"
          onClick={onUseMinimum}
          className="rounded-md bg-surface-container-high px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-primary ring-1 ring-outline-variant/15 transition-colors hover:bg-surface-container"
        >
          Min {formatMoney(minStr)}
        </button>
        {CHIP_ADDS.map((add) => {
          const v = minNumeric + add;
          const label = add >= 1000 ? `+$${add / 1000}k` : `+$${add}`;
          return (
            <button
              key={add}
              type="button"
              onClick={() => onAmountChange(v.toFixed(2))}
              className="rounded-md bg-surface-container-high px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface ring-1 ring-outline-variant/15 transition-colors hover:bg-primary hover:text-on-primary"
            >
              {label}
            </button>
          );
        })}
      </div>
      <div>
        <label
          htmlFor="bid-amount"
          className="mb-4 block font-label text-[10px] uppercase tracking-widest text-on-surface-variant"
        >
          Enter bid amount (min. {formatMoney(minStr)})
        </label>
        <div className="flex items-center border-b-2 border-outline-variant/40 py-4 transition-colors focus-within:border-primary">
          <span className="mr-4 font-headline text-2xl text-on-surface">$</span>
          <UnderlineInput
            id="bid-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="border-0 p-0 text-3xl focus:shadow-none"
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="bid-max-auto"
          className="mb-4 block font-label text-[10px] uppercase tracking-widest text-on-surface-variant"
        >
          Set max auto-bid (optional)
        </label>
        <div className="flex items-center border-b-2 border-outline-variant/30 py-3 transition-colors focus-within:border-primary">
          <span className="mr-4 font-headline text-xl text-on-surface">$</span>
          <UnderlineInput
            id="bid-max-auto"
            inputMode="decimal"
            placeholder="Single bid only if empty"
            value={maxAuto}
            onChange={(e) => onMaxAutoChange(e.target.value)}
            className="border-0 p-0 text-xl focus:shadow-none"
          />
        </div>
      </div>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="primary" className="w-full py-6" onClick={onReview}>
        Review bid amount
      </Button>
    </div>
  );
}
