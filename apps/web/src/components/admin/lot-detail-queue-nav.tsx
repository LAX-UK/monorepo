import { Button } from "@/components/ui/button";
import { getAdminLotList } from "@/lib/data/http/admin.server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  lotId: string;
  saleId: string | null;
  lotNumber: number | null;
};

/** Previous / next lot within the same sale (by lot number, then title). */
export async function LotDetailQueueNav({ lotId, saleId, lotNumber }: Props) {
  if (!saleId) return null;

  const lots = await getAdminLotList({ saleId, limit: 500, sort: "createdDesc" }).catch(() => []);
  if (lots.length < 2) return null;

  const ordered = [...lots].sort((a, b) => {
    const an = a.lotNumber ?? Number.MAX_SAFE_INTEGER;
    const bn = b.lotNumber ?? Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return a.title.localeCompare(b.title);
  });

  const idx = ordered.findIndex((l) => l.id === lotId);
  if (idx < 0) return null;

  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx < ordered.length - 1 ? ordered[idx + 1] : null;
  if (!prev && !next) return null;

  const position =
    lotNumber != null
      ? `Lot ${lotNumber} · ${idx + 1} of ${ordered.length}`
      : `${idx + 1} of ${ordered.length} in sale`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {prev ? (
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/admin/lots/${prev.id}`}>
            <ChevronLeft className="size-4" aria-hidden />
            Previous
          </Link>
        </Button>
      ) : null}
      <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        {position}
      </span>
      {next ? (
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/admin/lots/${next.id}`}>
            Next
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
