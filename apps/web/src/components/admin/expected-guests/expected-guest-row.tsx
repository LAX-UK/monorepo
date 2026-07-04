"use client";

import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import { formatDateTime } from "@/lib/ui/format";
import type { OnsiteEventSegmentOption, SaleDeliveryMode } from "@auction/types";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useState } from "react";
import { ExpectedGuestRowActions } from "./expected-guest-row-actions";
import { accountBlockers, guestDisplayName, segmentLabel } from "./guest-helpers";

export function ExpectedGuestRow({
  saleId,
  deliveryMode,
  guest,
  segmentOptions,
}: {
  saleId: string;
  deliveryMode: SaleDeliveryMode;
  guest: AdminExpectedGuestRow;
  segmentOptions: OnsiteEventSegmentOption[];
}) {
  const [rowPending, setRowPending] = useState(false);
  const blockers = accountBlockers(guest);
  const noEntity = guest.eligibleEntities.length === 0;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-opacity",
        rowPending && "opacity-60",
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{guestDisplayName(guest)}</p>
        <p className="font-body text-xs text-on-surface-variant">{guest.email}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{segmentLabel(segmentOptions, guest.attendanceSegment)}</Badge>
          {guest.galaCheckedInAt ? (
            <Badge variant="secondary">Gala {formatDateTime(guest.galaCheckedInAt)}</Badge>
          ) : null}
          {blockers.map((blocker) => (
            <Badge key={blocker} variant="destructive">
              {blocker}
            </Badge>
          ))}
          {noEntity ? <Badge variant="destructive">No entity</Badge> : null}
          {blockers.length === 0 && !noEntity ? <Badge variant="secondary">Ready</Badge> : null}
        </div>
      </div>
      <ExpectedGuestRowActions
        saleId={saleId}
        deliveryMode={deliveryMode}
        guest={guest}
        onPendingChange={setRowPending}
      />
    </li>
  );
}
