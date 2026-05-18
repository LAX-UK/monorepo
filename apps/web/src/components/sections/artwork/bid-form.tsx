"use client";

import { BidErrorView } from "@/components/bid/bid-error-view";
import { BidStepper } from "@/components/sections/artwork/online/bid-stepper";
import { UnderlineInput } from "@/components/ui/input";
import { formatMoney } from "@/lib/format-currency";
import type { BidErrorPresentation } from "@/lib/ui/bid-error";
import type { LotAuctionType } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useId } from "react";

type Props = {
  auctionType: LotAuctionType;
  minNumeric: number;
  amount: string;
  maxAuto: string;
  onAmountChange: (value: string) => void;
  onMaxAutoChange: (value: string) => void;
  onReview: () => void;
  onUseMinimum: () => void;
  error: BidErrorPresentation | null;
  /** When false, max auto-bid is captured elsewhere (e.g. `LotAutoBidPanel`). */
  showMaxAutoField?: boolean;
  className?: string;
  reviewButtonClassName?: string;
  amountFieldVariant?: "input" | "stepper" | "hidden";
  /** Used when `amountFieldVariant` is `stepper` (typically `lot.minBidIncrement`). */
  stepNumeric?: number;
  /** Label for the primary step-1 action (default Review bid). */
  step1ButtonLabel?: string;
};

const CHIP_ADDS = [500, 1000, 5000] as const;

export function BidForm({
  auctionType,
  minNumeric,
  amount,
  maxAuto,
  onAmountChange,
  onMaxAutoChange,
  onReview,
  onUseMinimum,
  error,
  showMaxAutoField = true,
  className,
  reviewButtonClassName,
  amountFieldVariant = "input",
  stepNumeric = 0.01,
  step1ButtonLabel = "Review bid",
}: Props) {
  const minStr = minNumeric.toFixed(2);
  const amountInputId = useId();

  const showIncrementChips =
    amountFieldVariant === "input" && (auctionType === "english" || auctionType === "buy_it_now");

  const previewNum = Number.parseFloat(amount.trim() === "" ? minStr : amount);
  const previewForConfirm = Number.isFinite(previewNum) ? previewNum.toFixed(2) : minStr;

  return (
    <div className={cn("space-y-8", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Quick bid
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onUseMinimum}
          className="h-auto rounded-md bg-surface-container-high px-4 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary ring-1 ring-outline-variant/15 hover:bg-surface-container"
        >
          {auctionType === "dutch" ? `Accept ${formatMoney(minStr)}` : `Min ${formatMoney(minStr)}`}
        </Button>
        {showIncrementChips
          ? CHIP_ADDS.map((add) => {
              const v = minNumeric + add;
              const label = add >= 1000 ? `+$${add / 1000}k` : `+$${add}`;
              return (
                <Button
                  key={add}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onAmountChange(v.toFixed(2))}
                  className="h-auto rounded-md bg-surface-container-high px-4 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface ring-1 ring-outline-variant/15 hover:bg-primary hover:text-on-primary"
                >
                  {label}
                </Button>
              );
            })
          : null}
        {showIncrementChips ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant hover:text-primary"
            onClick={() => document.getElementById(amountInputId)?.focus()}
          >
            Enter custom
          </Button>
        ) : null}
      </div>
      {amountFieldVariant === "hidden" ? null : amountFieldVariant === "stepper" ? (
        <div className="space-y-3">
          <span className="block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Enter bid amount (min. {formatMoney(minStr)})
          </span>
          <BidStepper
            amount={amount.trim() === "" ? minStr : amount}
            minNumeric={minNumeric}
            stepNumeric={stepNumeric}
            onAmountChange={onAmountChange}
          />
        </div>
      ) : (
        <div>
          <label
            htmlFor={amountInputId}
            className="mb-4 block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
          >
            Enter bid amount (min. {formatMoney(minStr)})
          </label>
          <div className="flex items-center border-b-2 border-outline-variant/40 py-4 transition-colors focus-within:border-primary">
            <span className="mr-4 font-headline text-2xl text-on-surface">$</span>
            <UnderlineInput
              id={amountInputId}
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="border-0 p-0 text-3xl focus:shadow-none"
            />
          </div>
        </div>
      )}
      {showMaxAutoField && (auctionType === "english" || auctionType === "buy_it_now") ? (
        <div>
          <label
            htmlFor="bid-max-auto"
            className="mb-4 block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
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
      ) : null}
      <BidErrorView error={error} />
      <div className="space-y-2">
        <Button
          type="button"
          className={cn("h-auto w-full py-6", reviewButtonClassName)}
          onClick={onReview}
        >
          {step1ButtonLabel}
        </Button>
        <p className="text-center text-xs text-on-surface-variant">
          You&apos;ll confirm {formatMoney(previewForConfirm)} before it&apos;s placed.
        </p>
      </div>
    </div>
  );
}
