import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import Link from "next/link";

type Props = {
  saleId: string;
  lotCount: number;
  liveish: boolean;
  venueLine: string | null;
  compact?: boolean;
};

export function SaleDetailAsideLinks({
  saleId,
  lotCount,
  liveish,
  venueLine,
  compact = false,
}: Props) {
  return (
    <>
      <div>
        <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Lots
        </p>
        <Link
          href={saleDetailTabHref(saleId, "lots")}
          className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
        >
          {lotCount} lot{lotCount === 1 ? "" : "s"}
        </Link>
      </div>
      {liveish ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Saleroom
          </p>
          <Link
            href={`/admin/saleroom/${saleId}`}
            className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
          >
            Open saleroom
          </Link>
        </div>
      ) : null}
      {venueLine && !compact ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Venue
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">{venueLine}</p>
        </div>
      ) : null}
    </>
  );
}
