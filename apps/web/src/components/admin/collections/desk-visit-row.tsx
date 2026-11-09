"use client";

import {
  BOOKING_BADGES,
  idTypeLabel,
  lotLabel,
  lotReadiness,
  timeRange,
} from "@/lib/admin/collections/desk.vm";
import { RecordThumbnail, StaffButton, StatusBadge } from "@auction/staff-ui";
import type { DeskBookingView } from "@auction/types";

export type DeskRowHandlers = {
  onHandOver: (booking: DeskBookingView) => void;
  onNotCollected: (booking: DeskBookingView) => void;
  onRebook: (booking: DeskBookingView) => void;
  onUndo: (booking: DeskBookingView) => void;
};

/** The row's columns from a wide screen; the header above the rows uses the same ones. */
const ROW_COLUMNS =
  "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_19rem]";

/** Column headings for a wide screen; on a phone the rows stack and need none. */
export function DeskColumnHeaders() {
  return (
    <div
      aria-hidden="true"
      className={`hidden gap-6 px-4 pb-2 text-staff-xs font-medium text-staff-muted lg:grid ${ROW_COLUMNS}`}
    >
      <span>Buyer</span>
      <span>Collector</span>
      <span>Lots</span>
      <span>Work</span>
      <span>Booking</span>
      <span />
    </div>
  );
}

const collectorKind = (booking: DeskBookingView): string => {
  switch (booking.collector.kind) {
    case "third_party":
      return `Third party${booking.collector.company ? ` · ${booking.collector.company}` : ""}`;
    case "member":
      return "Named member";
    case "self":
      return "Account holder";
  }
};

/**
 * One visit: who it is for, who collects, the works and whether each is released, and what staff
 * can do. On a phone the parts stack, so the desk can use it standing up. A visit staff made, or
 * one taken over capacity, says so; the person who made a client's booking is never named here.
 */
export function DeskVisitRow({
  booking,
  canChange,
  handlers,
  showTime = false,
}: {
  booking: DeskBookingView;
  canChange: boolean;
  handlers: DeskRowHandlers;
  /** Draw the time in the row, for lists that are not grouped by time. */
  showTime?: boolean;
}) {
  const badge = BOOKING_BADGES[booking.status];
  const lots = booking.lots.filter((lot) => lot.active || lot.outcome !== null);
  const waiting =
    booking.status === "booked" && lots.some((lot) => lotReadiness(lot).label === "Release first");
  const can = (action: DeskBookingView["actions"][number]) =>
    canChange && booking.actions.includes(action);

  return (
    <li
      className={`grid gap-3 py-4 first:pt-0 last:pb-0 lg:items-center lg:gap-6 ${ROW_COLUMNS}`}
      data-booking={booking.reference}
    >
      <div className="min-w-0">
        <p className="truncate text-staff-sm font-medium text-staff-fg">{booking.buyer.name}</p>
        <p className="text-staff-xs text-staff-muted">
          {booking.reference}
          {showTime ? ` · ${timeRange(booking)}` : ""}
          {booking.bookedVia === "staff" ? " · Booked by staff" : ""}
          {booking.overCapacity ? " · Over capacity" : ""}
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-staff-sm text-staff-fg">{booking.collector.name}</p>
        <p className="text-staff-xs text-staff-muted">
          {collectorKind(booking)}
          {booking.idCheckType ? ` · ${idTypeLabel(booking.idCheckType)} checked` : ""}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <ul className="flex flex-wrap gap-2" aria-label="Lots">
          {lots.map((lot) => (
            <li key={lot.lotId} className="flex items-center gap-2" title={lotLabel(lot)}>
              <RecordThumbnail
                src={lot.image}
                title={lot.title}
                className="size-9 rounded-staff-xs"
              />
              <span className="sr-only">{lotLabel(lot)}</span>
            </li>
          ))}
        </ul>
        <span className="text-staff-xs text-staff-muted">
          {lots.length === 1 && lots[0] ? lotLabel(lots[0]) : `${lots.length} lots`}
        </span>
      </div>

      <div>
        {booking.status === "booked" ? (
          waiting ? (
            <StatusBadge tone="warning">Release first</StatusBadge>
          ) : (
            <StatusBadge tone="success">All released</StatusBadge>
          )
        ) : null}
      </div>

      <div>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
      </div>

      <div className="flex flex-wrap gap-2">
        {can("hand_over") ? (
          <StaffButton variant="primary" size="sm" onClick={() => handlers.onHandOver(booking)}>
            Hand over
          </StaffButton>
        ) : null}
        {can("undo") ? (
          <StaffButton variant="secondary" size="sm" onClick={() => handlers.onUndo(booking)}>
            Undo hand-over
          </StaffButton>
        ) : null}
        {can("rebook") ? (
          <StaffButton variant="secondary" size="sm" onClick={() => handlers.onRebook(booking)}>
            Rebook
          </StaffButton>
        ) : null}
        {can("not_collected") ? (
          <StaffButton variant="ghost" size="sm" onClick={() => handlers.onNotCollected(booking)}>
            Not collected
          </StaffButton>
        ) : null}
      </div>
    </li>
  );
}
