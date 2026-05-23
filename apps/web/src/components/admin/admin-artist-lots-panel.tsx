import { formatMoney } from "@/lib/ui/format";
import type { Lot } from "@auction/types";
import Link from "next/link";

type Props = {
  artistId: string;
  lots: Lot[];
};

const STATUS_TONE: Record<Lot["status"], string> = {
  draft: "bg-surface-container-low text-on-surface-variant",
  scheduled: "bg-secondary-container text-on-secondary-container",
  active: "bg-primary text-on-primary",
  ended: "bg-surface-container text-on-surface-variant",
  cancelled: "bg-error-container text-on-error-container",
  voided: "bg-error-container text-on-error-container",
};

/** Lots currently attached to a given artist via FK. Renders inside the admin
 * artist edit page so curators can verify their attribution choices. The
 * panel is intentionally read-only — to reassign a lot, click through and use
 * the lot edit form. */
export function AdminArtistLotsPanel({ artistId, lots }: Props) {
  if (lots.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-outline-variant/40 p-6 text-center text-sm text-on-surface-variant">
        No lots are attached to this artist yet. Use the lot edit form to attach existing lots, or
        approve a new submission with this artist selected.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-outline-variant/30">
      <table className="w-full text-sm">
        <thead className="bg-surface-container-lowest text-left font-label text-xs uppercase tracking-wide text-on-surface-variant">
          <tr>
            <th className="px-4 py-2">Lot</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Hammer / start</th>
            <th className="px-4 py-2 text-right">Edit</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={lot.id} className="border-t border-border-hairline">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/lots/${lot.id}`}
                  className="font-medium text-on-surface hover:text-primary"
                >
                  {lot.title}
                </Link>
                <p className="text-xs text-on-surface-variant">
                  {lot.medium ?? "—"}
                  {lot.artistReviewRequired ? " · review required" : ""}
                </p>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 font-label text-[11px] uppercase tracking-wide ${STATUS_TONE[lot.status]}`}
                >
                  {lot.status}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                {formatMoney(
                  lot.status === "ended" ? lot.currentPrice : lot.startingPrice,
                  lot.marketingDetails?.estimate?.currency ?? "GBP",
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/lots/${lot.id}/edit`}
                  className="font-label text-xs uppercase tracking-wide text-primary hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-hairline bg-surface-container-lowest/50 px-4 py-2 text-xs text-on-surface-variant">
        Showing the {lots.length} most recent lots. Use the catalogue to filter the full archive by
        artist (
        <code className="rounded bg-surface-container px-1 py-0.5">?artistId={artistId}</code>).
      </p>
    </div>
  );
}
