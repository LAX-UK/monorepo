"use client";

import { ListSection } from "@/components/workspace/list-section";
import { sellerReofferHref } from "@/lib/seller/seller-reoffer-links";
import type { SellerReofferRowVm } from "@/lib/seller/seller-reoffer.vm";
import { RecordList, RecordRow } from "@auction/ui/components/record-row";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import Link from "next/link";

/**
 * Works whose buyer did not pay and that we asked to offer to the next bidder: the ones waiting
 * on an answer first, then the latest that finished. It sits above Sold & payouts' own list and
 * is not there at all when there is nothing to show.
 */
export function SellerReofferRows({ rows }: { rows: readonly SellerReofferRowVm[] }) {
  if (rows.length === 0) return null;
  return (
    <ListSection
      id="reoffer-requests"
      title="Offers to the next bidder"
      count={rows.length}
      className="mt-0"
    >
      <RecordList aria-label="Offers to the next bidder">
        {rows.map((row) => (
          <RecordRow
            key={row.id}
            aria-label={`${row.title}, ${row.badge.label}`}
            href={sellerReofferHref(row.id)}
            linkAs={Link}
            title={row.title}
            meta={row.meta}
            figures={[{ id: "offer", value: row.offer, label: "offer" }]}
            aligned
            status={
              <StatusBadge tone={row.badge.tone} shape={row.badge.shape}>
                {row.badge.label}
              </StatusBadge>
            }
          />
        ))}
      </RecordList>
    </ListSection>
  );
}
