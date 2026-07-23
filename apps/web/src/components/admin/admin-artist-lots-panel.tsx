import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { DetailEntityTable } from "@/components/admin/catalog/detail-board";
import { formatMoney } from "@/lib/ui/format";
import type { Lot } from "@auction/types";
import Link from "next/link";

type Props = {
  artistId: string;
  lots: Lot[];
};

/** Lots currently attached to a given artist via FK. */
export function AdminArtistLotsPanel({ artistId, lots }: Props) {
  return (
    <DetailEntityTable
      rows={lots}
      getRowId={(lot) => lot.id}
      emptyTitle="No lots attached"
      emptyDescription="Use the lot edit form to attach existing lots, or approve a new submission with this artist selected."
      footer={
        lots.length > 0 ? (
          <span>
            Showing the {lots.length} most recent lots. Filter the full archive by artist (
            <code className="rounded bg-surface-container px-1 py-0.5">?artistId={artistId}</code>
            ).
          </span>
        ) : undefined
      }
      columns={[
        {
          id: "lot",
          header: "Lot",
          cell: (lot) => (
            <div>
              <Link
                href={`/admin/lots/${lot.id}`}
                className="font-medium text-on-surface hover:text-link"
              >
                {lot.title}
              </Link>
              <p className="text-xs text-on-surface-variant">
                {lot.medium ?? "—"}
                {lot.artistReviewRequired ? " · review required" : ""}
              </p>
            </div>
          ),
        },
        {
          id: "status",
          header: "Status",
          cell: (lot) => (
            <AdminStatusBadge
              domain="lot"
              status={lot.status}
              context={{ lot: { winnerId: lot.winnerId } }}
            />
          ),
        },
        {
          id: "hammer",
          header: "Hammer / start",
          cell: (lot) => (
            <span className="font-mono text-xs">
              {formatMoney(
                lot.status === "ended" ? lot.currentPrice : lot.startingPrice,
                lot.marketingDetails?.estimate?.currency ?? "GBP",
              )}
            </span>
          ),
        },
        {
          id: "edit",
          header: "",
          headerClassName: "sr-only",
          className: "text-right",
          cell: (lot) => (
            <Link
              href={`/admin/lots/${lot.id}/edit`}
              className="font-label text-xs uppercase tracking-wide text-link hover:underline"
            >
              Edit
            </Link>
          ),
        },
      ]}
    />
  );
}
