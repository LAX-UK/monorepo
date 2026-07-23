import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { Building2, Package } from "lucide-react";
import Link from "next/link";

type Props = {
  submitterLegalEntityId: string | null;
  submitterDisplayName: string | null;
  convertedLotId: string | null;
  createdAt: Date | string | null | undefined;
  updatedAt: Date | string | null | undefined;
};

/** Seller, lot link, and dates row under submission detail title. */
export function SubmissionDetailMetaRow({
  submitterLegalEntityId,
  submitterDisplayName,
  convertedLotId,
  createdAt,
  updatedAt,
}: Props) {
  const hasContent = submitterLegalEntityId || convertedLotId || createdAt || updatedAt;

  if (!hasContent) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-sm text-on-surface-variant">
      {submitterLegalEntityId ? (
        <Link
          href={`/admin/legal-entities/${submitterLegalEntityId}`}
          className="inline-flex items-center gap-1.5 hover:text-on-surface"
        >
          <Building2 className="size-4 shrink-0 text-secondary" aria-hidden />
          {submitterDisplayName ?? "Seller"}
        </Link>
      ) : null}
      {convertedLotId ? (
        <Link
          href={`/admin/lots/${convertedLotId}`}
          className="inline-flex items-center gap-1.5 hover:text-on-surface"
        >
          <Package className="size-4 shrink-0 text-secondary" aria-hidden />
          Converted lot
        </Link>
      ) : null}
      {createdAt ? (
        <span className="inline-flex items-center gap-1">
          Submitted{" "}
          <AdminTableDateTimeCell iso={createdAt} mode="timestamp" className="inline-block" />
        </span>
      ) : null}
      {updatedAt ? (
        <span className="inline-flex items-center gap-1">
          Updated{" "}
          <AdminTableDateTimeCell iso={updatedAt} mode="timestamp" className="inline-block" />
        </span>
      ) : null}
    </div>
  );
}
