"use client";

import { MediaImage } from "@/components/ui/media-image";
import { ListSection } from "@/components/workspace/list-section";
import { RowStep } from "@/components/workspace/row-step";
import type { BidderReofferRowVm } from "@/lib/reoffer/bidder-reoffer.vm";
import { RecordList, RecordRow, RecordRowMedia } from "@auction/ui/components/record-row";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import Link from "next/link";

/**
 * Offers to buy a lot at the account's own bid, waiting on its answer, pinned above the bids until
 * each is answered or ends. It is not there at all when there is nothing to answer.
 */
export function ReofferOfferRows({ rows }: { rows: readonly BidderReofferRowVm[] }) {
  if (rows.length === 0) return null;
  return (
    <ListSection
      id="reoffer-offers"
      title="Offers for you"
      count={rows.length}
      description="Lots offered to you at your own bid after the winning bidder did not pay."
      className="mt-0"
    >
      <RecordList aria-label="Offers for you">
        {rows.map((row) => (
          <RecordRow
            key={row.id}
            aria-label={`${row.title}, offer open`}
            href={row.href}
            linkAs={Link}
            leading={
              <RecordRowMedia>
                <MediaImage src={row.image} alt="" sizes="48px" />
              </RecordRowMedia>
            }
            title={row.title}
            meta={[...row.meta, row.ends]}
            figures={[{ id: "offer", value: row.offerLabel, label: "your bid" }]}
            aligned
            status={<StatusBadge tone="info">Offer</StatusBadge>}
            action={
              <RowStep
                label="Review the offer"
                accessibleName={`Review the offer, ${row.title}`}
                href={row.href}
              />
            }
            needsYou
          />
        ))}
      </RecordList>
    </ListSection>
  );
}
