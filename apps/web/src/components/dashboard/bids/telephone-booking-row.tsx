"use client";

import type { TelephoneBookingRowVm } from "@/lib/telephone/telephone-booking-rows.vm";
import { RecordRow, RecordRowMedia } from "@auction/ui";
import { StatusBadge } from "@auction/ui/lax";
import { Phone } from "lucide-react";
import Link from "next/link";

/** One telephone line the person booked: the sale, when they asked, its state and their maximum. */
export function TelephoneBookingRow({ row }: { row: TelephoneBookingRowVm }) {
  return (
    <RecordRow
      aria-label={`${row.title}, ${row.status.label}`}
      href={row.href}
      linkAs={Link}
      leading={
        <RecordRowMedia className="grid place-items-center text-lax-muted">
          <Phone aria-hidden className="size-5" strokeWidth={1.5} />
        </RecordRowMedia>
      }
      // The whole title stays readable where a narrow row cuts it short.
      title={<span title={row.title}>{row.title}</span>}
      meta={row.meta}
      {...(row.figure ? { figures: [row.figure] } : {})}
      aligned
      // Keeps the action column, so the badges line up with the other lists on the page.
      action={null}
      status={
        <StatusBadge tone={row.status.tone} shape={row.status.shape}>
          {row.status.label}
        </StatusBadge>
      }
    />
  );
}
