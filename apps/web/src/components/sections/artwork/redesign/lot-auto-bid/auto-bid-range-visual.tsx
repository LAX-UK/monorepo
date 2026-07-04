import { formatMoney } from "@/lib/format-currency";

export function AutoBidRangeVisual({
  currentPrice,
  maxAuto,
}: {
  currentPrice: string;
  maxAuto: string;
}) {
  const currentN = Number.parseFloat(currentPrice);
  const maxN = Number.parseFloat(maxAuto);
  if (!Number.isFinite(currentN) || !Number.isFinite(maxN) || maxN <= currentN) {
    return null;
  }
  const pct = Math.min(100, Math.max(8, (currentN / maxN) * 100));
  return (
    <div className="mt-3 space-y-2" aria-hidden>
      <div className="flex justify-between font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
        <span>Current {formatMoney(currentPrice)}</span>
        <span>Your max {formatMoney(maxAuto)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
