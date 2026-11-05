"use client";

import { whereItIsLine } from "@/server/domain/where-it-is.vm";
import { ZOHO_QUEUE_PATH, buildRegisterTimeline } from "@/server/domain/zoho-register.vm";
import type { AdminArtworkDetail } from "@auction/shop-contracts";
import { StaffButton, WhereItIsSection, useStaffCan } from "@auction/staff-ui";
import { ArrowUpRight } from "@auction/staff-ui/icons";
import Link from "next/link";

/**
 * Where a linked lax.art artwork is, in the rail of its page: the same section and words as on its
 * From Zoho record. Publishing and taking it off lax.art are what move it; the section only says
 * where it is, and links to the record behind it for people who can open the register.
 */
export function ZohoWherePanel({
  link,
  createdAt,
}: {
  link: NonNullable<AdminArtworkDetail["zohoLink"]>;
  createdAt: string;
}) {
  const canOpenRecord = useStaffCan("artwork_register.read");
  const line = whereItIsLine(link.whereItIs, { draftCreatedAt: createdAt });
  const moves = buildRegisterTimeline(link.recentMoves);
  return (
    <WhereItIsSection
      chip={link.whereItIs.chip}
      lead={line.lead}
      {...(line.trail ? { trail: line.trail } : {})}
      {...(line.note ? { note: line.note } : {})}
      {...(canOpenRecord
        ? {
            actions: (
              <StaffButton
                variant="secondary"
                size="sm"
                icon={<ArrowUpRight aria-hidden />}
                asChild
              >
                <Link href={`${ZOHO_QUEUE_PATH}/${link.registerId}`}>From Zoho record</Link>
              </StaffButton>
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
