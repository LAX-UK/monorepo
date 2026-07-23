import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { LotAuctionTypeChip } from "@/components/admin/lot-auction-type-chip";
import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { Lot } from "@auction/types";
import { Building2, Gavel, Palette } from "lucide-react";
import Link from "next/link";

type Props = {
  auction: Lot;
  context: LotDetailContext;
  bidCount?: number | null;
  updatedAt?: Date | string | null;
};

/** Sale link, category, updated, bid count row under lot detail title (Figma header meta). */
export function LotDetailMetaRow({ auction, context, bidCount = null, updatedAt }: Props) {
  const sale = context.sale;
  const artist = context.artist;
  const category = context.categories[0];
  const updatedSource =
    updatedAt != null
      ? typeof updatedAt === "string"
        ? updatedAt
        : updatedAt.toISOString()
      : auction.updatedAt?.toISOString();
  const updatedPresentation = updatedSource
    ? formatAdminTableDateTime(updatedSource, "timestamp")
    : null;

  if (!sale && !artist && !category && bidCount == null && !updatedPresentation) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-sm text-on-surface-variant">
      <LotAuctionTypeChip auctionType={auction.auctionType} />
      {sale ? (
        <Link
          href={`/admin/sales/${sale.id}`}
          className="inline-flex items-center gap-1.5 hover:text-on-surface"
        >
          <Building2 className="size-4 shrink-0 text-secondary" aria-hidden />
          {sale.title}
        </Link>
      ) : null}
      {artist ? (
        <Link
          href={`/admin/artists/${artist.id}`}
          className="inline-flex items-center gap-1.5 hover:text-on-surface"
        >
          <Palette className="size-4 shrink-0 text-secondary" aria-hidden />
          {artist.displayName}
        </Link>
      ) : null}
      {category ? (
        <Link
          href={`/admin/categories/${category.id}`}
          className="inline-flex items-center gap-1.5 hover:text-on-surface"
        >
          {category.name}
        </Link>
      ) : null}
      {bidCount != null ? (
        <span className="inline-flex items-center gap-1.5">
          <Gavel className="size-4 shrink-0 text-secondary" aria-hidden />
          {bidCount} {bidCount === 1 ? "bid" : "bids"}
        </span>
      ) : null}
      {updatedPresentation ? (
        <span className="inline-flex items-center gap-1">
          Updated{" "}
          <AdminTableDateTimeCell iso={updatedSource} mode="timestamp" className="inline-block" />
        </span>
      ) : null}
      {auction.endTime ? (
        <span className="inline-flex items-center gap-1">
          Ends{" "}
          <AdminTableDateTimeCell
            iso={auction.endTime}
            mode="deadline"
            live
            className="inline-block"
          />
        </span>
      ) : null}
    </div>
  );
}
