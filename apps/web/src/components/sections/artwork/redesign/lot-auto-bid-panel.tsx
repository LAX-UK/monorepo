import { UnderlineInput } from "@/components/ui/input";
import { formatMoney } from "@/lib/format-currency";
import type { LotAuctionType } from "@auction/types";
import { BodyText } from "@auction/ui";
import { Button } from "@auction/ui/components/button";

type Props = {
  auctionType: LotAuctionType;
  /** Bound to bid form state */
  maxAuto: string;
  onMaxAutoChange: (v: string) => void;
  /** Latest server-known cap for this user (optional; helps show “active” state after reload) */
  serverMaxAuto: string | null;
  disabled: boolean;
};

const ELIGIBLE: LotAuctionType[] = ["english", "buy_it_now"];

/**
 * First-class auto-bid surface; values are submitted with `placeBid` via parent `ArtworkBidPanel`.
 */
export function LotAutoBidPanel({
  auctionType,
  maxAuto,
  onMaxAutoChange,
  serverMaxAuto,
  disabled,
}: Props) {
  if (!ELIGIBLE.includes(auctionType)) return null;

  const activeLabel =
    maxAuto.trim() !== "" ? maxAuto : serverMaxAuto && serverMaxAuto !== "" ? serverMaxAuto : null;

  return (
    <div className="w-full max-w-[550px] rounded border border-[#474747] bg-surface-container-low/40 p-4 dark:border-outline-variant">
      <p className="mb-1 font-label text-xs font-semibold uppercase tracking-[0.05em] text-[#0A0A0A] dark:text-on-surface">
        Auto-bid
      </p>
      {activeLabel ? (
        <BodyText className="mb-3 text-sm text-on-surface-variant">
          {`Your max auto-bid is ${formatMoney(activeLabel)}. We’ll raise bids for you up to this amount.`}
        </BodyText>
      ) : (
        <BodyText className="mb-3 text-sm text-on-surface-variant">
          Optional: set the maximum you’re willing to pay. We’ll bid incrementally on your behalf.
        </BodyText>
      )}
      <label htmlFor="lot-auto-bid-max" className="sr-only">
        Max auto-bid amount
      </label>
      <div className="flex items-center gap-2 border-b border-[#A3A3A3] py-2 dark:border-outline-variant">
        <span className="font-headline text-lg text-[#050505] dark:text-on-surface">$</span>
        <UnderlineInput
          id="lot-auto-bid-max"
          inputMode="decimal"
          placeholder="Set max (optional)"
          value={maxAuto}
          onChange={(e) => onMaxAutoChange(e.target.value)}
          disabled={disabled}
          className="border-0 p-0 text-lg focus:shadow-none"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          disabled={disabled || maxAuto.trim() === ""}
          onClick={() => onMaxAutoChange("")}
        >
          Clear cap
        </Button>
      </div>
    </div>
  );
}
