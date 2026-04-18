import type { Lot, LotStatus } from "@auction/types";
import Link from "next/link";

const PIPELINE: LotStatus[] = ["draft", "scheduled", "active", "ended", "cancelled"];

type Props = {
  auctions: Lot[];
};

export function AdminAuctionPipeline({ auctions }: Props) {
  const groups = new Map<LotStatus, Lot[]>();
  for (const s of PIPELINE) groups.set(s, []);
  for (const a of auctions) {
    const list = groups.get(a.status);
    if (list) list.push(a);
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-[720px] gap-4">
        {PIPELINE.map((status) => {
          const list = groups.get(status) ?? [];
          return (
            <div
              key={status}
              className="w-56 flex-shrink-0 rounded-xl border border-outline-variant/20 bg-surface-container-low/60 p-3 ring-1 ring-outline-variant/10"
            >
              <h3 className="mb-3 border-b border-outline-variant/15 pb-2 font-label text-xs font-bold uppercase tracking-widest text-secondary">
                {status}
                <span className="ml-2 tabular-nums text-on-surface">({list.length})</span>
              </h3>
              <ul className="max-h-[min(70vh,520px)] space-y-2 overflow-y-auto pr-1">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/admin/lots/${a.id}`}
                      className="block rounded-md bg-surface-container-high/50 px-2 py-2 text-left text-sm text-on-surface ring-1 ring-outline-variant/10 transition-colors hover:bg-surface-container-high hover:ring-primary/25"
                    >
                      <span className="line-clamp-2 font-medium text-primary">{a.title}</span>
                      <span className="mt-1 block font-label text-[0.65rem] uppercase tracking-wider text-on-surface-variant">
                        {a.auctionType}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-4 font-body text-xs text-on-surface-variant">
        Read-only pipeline view — open a lot to publish, edit, or cancel. Drag-and-drop is not
        enabled yet.
      </p>
    </div>
  );
}
