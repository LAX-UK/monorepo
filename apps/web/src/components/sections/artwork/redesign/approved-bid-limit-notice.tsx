import { formatMoney } from "@/lib/ui/format";

type Props = {
  approvedBidLimit: number;
  currentPrice: string;
  currency?: string;
};

/** Proactive buyer-agent sale registration limit — shown before bid validation fails. */
export function ApprovedBidLimitNotice({
  approvedBidLimit,
  currentPrice,
  currency = "GBP",
}: Props) {
  const current = Number.parseFloat(currentPrice);
  const remaining =
    Number.isFinite(current) && current > 0
      ? Math.max(0, approvedBidLimit - current)
      : approvedBidLimit;

  return (
    <p className="font-body text-xs text-on-surface-variant" aria-live="polite">
      Approved limit:{" "}
      <span className="font-medium text-on-surface tabular-nums">
        {formatMoney(approvedBidLimit.toFixed(2), currency)}
      </span>
      {Number.isFinite(current) && current > 0 ? (
        <>
          {" "}
          · remaining ~{" "}
          <span className="font-medium text-on-surface tabular-nums">
            {formatMoney(remaining.toFixed(2), currency)}
          </span>{" "}
          at current price
        </>
      ) : null}
    </p>
  );
}
