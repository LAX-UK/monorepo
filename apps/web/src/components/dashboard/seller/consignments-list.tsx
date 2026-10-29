import { MediaImage } from "@/components/ui/media-image";
import { journeyCaption } from "@/lib/seller/consignment-journey";
import type { ConsignmentRow } from "@/lib/seller/consignments.vm";
import { RecordList, RecordRow, RecordRowMedia } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

/**
 * The consignments, one row each whether still a submission or already a lot: the work, where it
 * is on its way to sale, and its status. The whole row opens it.
 */
export function ConsignmentsList({ rows }: { rows: readonly ConsignmentRow[] }) {
  return (
    <RecordList aria-label="Consignments">
      {rows.map((row) => (
        <RecordRow
          key={row.key}
          href={row.href}
          linkAs={Link}
          leading={
            <RecordRowMedia>
              <MediaImage src={row.image} alt="" sizes="48px" />
            </RecordRowMedia>
          }
          title={row.title}
          meta={[row.context, row.journey ? journeyCaption(row.journey) : null]}
          status={<DotStatusPill label={row.statusLabel} tone={row.statusTone} />}
        />
      ))}
    </RecordList>
  );
}
