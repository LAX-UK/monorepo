import type { OrgWorkRow } from "@/app/(client)/collection/org-works.vm";
import { MediaImage } from "@/components/ui/media-image";
import { RecordList, RecordRow, RecordRowMedia } from "@auction/ui";
import Link from "next/link";
import { Fragment } from "react";

type Props = {
  rows: readonly OrgWorkRow[];
};

/** The works an organisation owns. The price shows only on rows the viewer's role may see. */
export function OrgWorksList({ rows }: Props) {
  return (
    <RecordList aria-label="Works won">
      {rows.map((row) => (
        <RecordRow
          key={row.lotId}
          href={row.href}
          linkAs={Link}
          leading={
            <RecordRowMedia>
              <MediaImage src={row.imageUrl} alt="" sizes="48px" />
            </RecordRowMedia>
          }
          title={row.title}
          meta={[
            row.lotNumberLabel,
            <Fragment key="won">
              Won <time dateTime={row.endedAtIso}>{row.endedAtLabel}</time>
            </Fragment>,
          ]}
          value={row.hammerPriceLabel}
        />
      ))}
    </RecordList>
  );
}
