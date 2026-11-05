"use client";

import { bidLotUrl } from "@/lib/offer-at-auction-links";
import { whereItIsLine } from "@/server/domain/where-it-is.vm";
import { ZOHO_QUEUE_PATH, buildRegisterTimeline } from "@/server/domain/zoho-register.vm";
import type { AdminArtworkDetail } from "@auction/shop-contracts";
import { StaffButton, WhereItIsSection, useStaffCan } from "@auction/staff-ui";
import { ArrowUpRight, ExternalLink } from "@auction/staff-ui/icons";
import Link from "next/link";

/**
 * Where a linked lax.art artwork is, in the rail of its page: the same section and words as on its
 * From Zoho record. Publishing and taking it off lax.art are what move it; the section only says
 * where it is, and links to the record behind it for people who can open the register.
 */
export function ZohoWherePanel({
  link,
  createdAt,
  bidAdminUrl = null,
}: {
  link: NonNullable<AdminArtworkDetail["zohoLink"]>;
  createdAt: string;
  /** Where Bid admin lives, for a person who can open it. */
  bidAdminUrl?: string | null;
}) {
  const canOpenRecord = useStaffCan("artwork_register.read");
  const line = whereItIsLine(link.whereItIs, { draftCreatedAt: createdAt });
  const moves = buildRegisterTimeline(link.recentMoves);
  const lotHref = link.whereItIs.bidLot
    ? bidLotUrl(bidAdminUrl, link.whereItIs.bidLot.lotId)
    : null;
  return (
    <WhereItIsSection
      chip={link.whereItIs.chip}
      lead={line.lead}
      {...(line.trail ? { trail: line.trail } : {})}
      {...(line.note ? { note: line.note } : {})}
      {...(canOpenRecord || lotHref
        ? {
            actions: (
              <>
                {canOpenRecord ? (
                  <StaffButton
                    variant="secondary"
                    size="sm"
                    icon={<ArrowUpRight aria-hidden />}
                    asChild
                  >
                    <Link href={`${ZOHO_QUEUE_PATH}/${link.registerId}`}>From Zoho record</Link>
                  </StaffButton>
                ) : null}
                {lotHref ? (
                  <StaffButton
                    variant="secondary"
                    size="sm"
                    icon={<ExternalLink aria-hidden />}
                    asChild
                  >
                    <a href={lotHref} target="_blank" rel="noopener noreferrer">
                      Open lot in LAX Bid
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </StaffButton>
                ) : null}
              </>
            ),
          }
        : {})}
      facts={[
        { label: "Stock code", value: link.stockCode, copyValue: link.stockCode },
        { label: "Zoho status", value: link.zohoStatus },
      ]}
      {...(moves.length > 0 ? { moves: { events: moves } } : {})}
    />
  );
}
