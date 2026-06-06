"use client";

import { formatDateTime } from "@/lib/ui/format";
import type { OnsiteEventRsvpAdminRow, OnsiteEventSegmentOption } from "@auction/types";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Mail } from "lucide-react";

type Props = {
  rows: OnsiteEventRsvpAdminRow[];
  segmentOptions: OnsiteEventSegmentOption[];
  resendingId: string | null;
  onResend: (rsvpId: string, guestName: string) => void;
};

function segmentLabel(options: OnsiteEventSegmentOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function OnsiteEventRsvpMobileCards({ rows, segmentOptions, resendingId, onResend }: Props) {
  return (
    <ul className="space-y-3 lg:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-4 space-y-3"
        >
          <div className="space-y-1">
            <p className="font-medium">{row.name}</p>
            <p className="font-body text-xs text-on-surface-variant">{row.email}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 font-body text-xs">
            <dt className="text-on-surface-variant">Segment</dt>
            <dd>{segmentLabel(segmentOptions, row.attendanceSegment)}</dd>
            <dt className="text-on-surface-variant">Plus-one</dt>
            <dd>{row.plusOne > 0 ? row.plusOneGuestName?.trim() || "Yes (+1)" : "Just guest"}</dd>
            <dt className="text-on-surface-variant">Check-in</dt>
            <dd>
              {row.checkedInAt ? (
                <Badge variant="secondary" className="text-[10px]">
                  {formatDateTime(row.checkedInAt)}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  Not arrived
                </Badge>
              )}
            </dd>
            <dt className="text-on-surface-variant">Updated</dt>
            <dd className="text-on-surface-variant">{formatDateTime(row.updatedAt)}</dd>
          </dl>
          {row.notes?.trim() ? (
            <p className="font-body text-xs text-on-surface-variant whitespace-pre-wrap">
              {row.notes.trim()}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full min-h-11"
            disabled={resendingId === row.id}
            onClick={() => onResend(row.id, row.name)}
          >
            <Mail className="mr-2 size-3.5" />
            {resendingId === row.id ? "Sending…" : "Resend pass"}
          </Button>
        </li>
      ))}
    </ul>
  );
}
