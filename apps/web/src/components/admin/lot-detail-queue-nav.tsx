import { getAdminLotList } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const QUEUE_LIMIT = 500;

type QueueSlice = {
  prev: { id: string; lotNumber: number | null } | null;
  next: { id: string; lotNumber: number | null } | null;
  index: number;
  total: number;
  partial: boolean;
};

async function loadSaleLotQueue(lotId: string, saleId: string): Promise<QueueSlice | null> {
  const lots = await getAdminLotList({ saleId, limit: QUEUE_LIMIT, sort: "createdDesc" }).catch(
    () => [],
  );
  if (lots.length < 2) return null;

  const ordered = [...lots].sort((a, b) => {
    const an = a.lotNumber ?? Number.MAX_SAFE_INTEGER;
    const bn = b.lotNumber ?? Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return a.title.localeCompare(b.title);
  });

  const idx = ordered.findIndex((l) => l.id === lotId);
  if (idx < 0) return null;

  const prevLot = idx > 0 ? ordered[idx - 1] : undefined;
  const nextLot = idx < ordered.length - 1 ? ordered[idx + 1] : undefined;

  return {
    prev: prevLot ?? null,
    next: nextLot ?? null,
    index: idx,
    total: ordered.length,
    partial: lots.length >= QUEUE_LIMIT,
  };
}

type Props = {
  lotId: string;
  saleId: string | null;
  lotNumber: number | null;
  /** Compact row for sticky subnav (no outer wrap). */
  compact?: boolean;
};

/** Previous / next lot within the same sale (by lot number, then title). */
export async function LotDetailQueueNav({ lotId, saleId, lotNumber, compact = false }: Props) {
  if (!saleId) return null;

  const queue = await loadSaleLotQueue(lotId, saleId);
  if (!queue || (!queue.prev && !queue.next)) return null;

  const position =
    lotNumber != null
      ? `Lot ${lotNumber} · ${queue.index + 1} of ${queue.total}${queue.partial ? "+" : ""}`
      : `${queue.index + 1} of ${queue.total}${queue.partial ? "+" : ""} in sale`;

  const nav = (
    <>
      {queue.prev ? (
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/admin/lots/${queue.prev.id}`}>
            <ChevronLeft className="size-4" aria-hidden />
            {compact ? null : "Previous"}
          </Link>
        </Button>
      ) : null}
      <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        {position}
      </span>
      {queue.next ? (
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/admin/lots/${queue.next.id}`}>
            {compact ? null : "Next"}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      ) : null}
      {queue.partial ? (
        <span className="w-full font-body text-[10px] text-warning sm:w-auto">
          Partial queue — only first {QUEUE_LIMIT} lots loaded.
        </span>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-border-hairline/60 px-1 py-2">
        {nav}
      </div>
    );
  }

  return <div className="flex flex-wrap items-center gap-2">{nav}</div>;
}
