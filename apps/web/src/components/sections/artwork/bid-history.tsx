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

function formatRelative(at: number): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffSec = Math.round((at - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec / 1), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86_400), "day");
}

export function BidHistory({ entries }: Props) {
  return (
    <div className="mt-10 border-t border-outline-variant/15 pt-10">
      <h3 className="mb-4 font-label text-xs uppercase tracking-widest text-secondary">
        Bid history
      </h3>
      {entries.length === 0 ? (
        <output className="block font-body text-sm text-on-surface-variant">No bids yet.</output>
      ) : (
        <ul className="max-h-52 space-y-3 overflow-y-auto pr-1">
          {entries.map((e) => (
            <li
              key={`${e.id}-${e.at}`}
              className="flex items-center justify-between gap-4 border-b border-outline-variant/10 pb-3 font-body text-sm last:border-0"
            >
              <div className="min-w-0">
                <span className="block text-on-surface-variant">{maskBidder(e.bidderId)}</span>
                <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant/80">
                  {formatRelative(e.at)}
                </span>
              </div>
              <span className="shrink-0 font-headline tabular-nums text-on-surface">
                {formatMoney(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
