import { formatMoney } from "@/lib/format-currency";

export type BidHistoryEntry = {
  id: string;
  bidderId: string;
  amount: string;
  at: number;
};

type Props = {
  entries: BidHistoryEntry[];
};

function maskBidder(id: string): string {
  return `•••${id.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

export function BidHistory({ entries }: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-10 border-t border-outline-variant/20 pt-10">
      <h3 className="mb-4 font-label text-[10px] uppercase tracking-widest text-secondary">
        Recent activity
      </h3>
      <ul className="max-h-48 space-y-3 overflow-y-auto pr-1">
        {entries.map((e) => (
          <li
            key={`${e.id}-${e.at}`}
            className="flex items-center justify-between gap-4 border-b border-outline-variant/10 pb-3 font-body text-sm last:border-0"
          >
            <span className="text-on-surface-variant">{maskBidder(e.bidderId)}</span>
            <span className="font-headline tabular-nums text-on-surface">{formatMoney(e.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
