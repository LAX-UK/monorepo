import { getAdminLotList } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
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
  saleTitle: string | null;
  lotNumber: number | null;
};

/** Back-to-sale link and stable prev/next lot sequence for lot detail context line. */
export async function LotDetailQueueNav({ lotId, saleId, saleTitle, lotNumber }: Props) {
  if (!saleId || !saleTitle) return null;

  const queue = await loadSaleLotQueue(lotId, saleId);
  const saleHref = `/admin/sales/${saleId}`;

  const positionLabel = queue
    ? lotNumber != null
      ? `Lot ${lotNumber} · ${queue.index + 1} of ${queue.total}${queue.partial ? "+" : ""}`
      : `Lot ${queue.index + 1} of ${queue.total}${queue.partial ? "+" : ""}`
    : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <Link
        href={saleHref}
        className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-body text-sm text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Back to {saleTitle}</span>
      </Link>

      {queue ? (
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {queue.prev ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/admin/lots/${queue.prev.id}`}>
                <ChevronLeft className="size-4" aria-hidden />
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Button>
          )}

          <span
            className="px-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
            aria-live="polite"
          >
            {positionLabel}
          </span>

          {queue.next ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/admin/lots/${queue.next.id}`}>
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          )}

          {queue.partial ? (
            <span className="w-full font-body text-[10px] text-warning sm:w-auto">
              Partial queue — only first {QUEUE_LIMIT} lots loaded.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
