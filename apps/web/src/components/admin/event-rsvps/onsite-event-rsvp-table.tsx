"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { OnsiteEventRsvpMobileCards } from "@/components/admin/event-rsvps/onsite-event-rsvp-mobile-cards";
import { formatDateTime } from "@/lib/ui/format";
import type { OnsiteEventRsvpAdminRow, OnsiteEventSegmentOption } from "@auction/types";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Mail } from "lucide-react";

type ArrivalFilter = "all" | "pending" | "arrived";

type Props = {
  rsvps: OnsiteEventRsvpAdminRow[];
  allRsvps: OnsiteEventRsvpAdminRow[];
  segmentOptions: OnsiteEventSegmentOption[];
  filter: ArrivalFilter;
  onFilterChange: (filter: ArrivalFilter) => void;
  resendingId: string | null;
  onResendConfirm: (rsvpId: string, guestName: string) => void;
};

function segmentLabel(options: OnsiteEventSegmentOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function OnsiteEventRsvpTable({
  rsvps,
  allRsvps,
  segmentOptions,
  filter,
  onFilterChange,
  resendingId,
  onResendConfirm,
}: Props) {
  return (
    <Surface className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">RSVPs ({rsvps.length})</h2>
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "arrived"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? "default" : "outline"}
              aria-pressed={filter === value}
              onClick={() => onFilterChange(value)}
            >
              {value === "all" ? "All" : value === "pending" ? "Not arrived" : "Arrived"}
            </Button>
          ))}
        </div>
      </div>
      {rsvps.length === 0 ? (
        <AdminEmptyState
          title={allRsvps.length === 0 ? "No RSVPs yet" : "No RSVPs in this view"}
          description={
            allRsvps.length === 0
              ? "Responses will appear here once guests submit the form."
              : filter === "pending"
                ? "Everyone on the list has already checked in."
                : filter === "arrived"
                  ? "No guests have checked in yet."
                  : "Try a different filter."
          }
        />
      ) : (
        <>
          <OnsiteEventRsvpMobileCards
            rows={rsvps}
            segmentOptions={segmentOptions}
            resendingId={resendingId}
            onResend={onResendConfirm}
          />
          <div className="hidden overflow-x-auto rounded-lg border border-border-hairline lg:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border-hairline bg-surface-container-low/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Guest</th>
                  <th className="px-3 py-2 font-medium">Segment</th>
                  <th className="px-3 py-2 font-medium">Plus-one</th>
                  <th className="px-3 py-2 font-medium">Check-in</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                  <th className="px-3 py-2 font-medium">Pass</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rsvps.map((row) => (
                  <tr key={row.id} className="border-b border-border-hairline last:border-0">
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium">{row.name}</p>
                      <p className="font-body text-xs text-on-surface-variant">{row.email}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {segmentLabel(segmentOptions, row.attendanceSegment)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {row.plusOne > 0 ? row.plusOneGuestName?.trim() || "Yes (+1)" : "Just guest"}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {row.checkedInAt ? (
                        <Badge variant="secondary">
                          Checked in {formatDateTime(row.checkedInAt)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not arrived</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top max-w-xs whitespace-pre-wrap text-on-surface-variant">
                      {row.notes?.trim() || "—"}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resendingId === row.id}
                        onClick={() => onResendConfirm(row.id, row.name)}
                      >
                        <Mail className="mr-2 size-3.5" />
                        {resendingId === row.id ? "Sending…" : "Resend pass"}
                      </Button>
                    </td>
                    <td className="px-3 py-3 align-top text-on-surface-variant whitespace-nowrap">
                      {formatDateTime(row.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Surface>
  );
}
