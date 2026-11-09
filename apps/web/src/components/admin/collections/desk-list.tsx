"use client";

import { deskDayLabel } from "@/lib/admin/collections/desk.vm";
import { londonDateKey } from "@auction/domain";
import { EmptyState, Notice } from "@auction/staff-ui";
import type { DeskListView } from "@auction/types";
import { DeskColumnHeaders, DeskVisitRow } from "./desk-visit-row";
import { useDeskDialogs } from "./use-desk-dialogs";

/**
 * Visits to come, or missed ones nobody has followed up, a day at a time. A missed visit offers
 * "Rebook" through the same picker; once it is rebooked it leaves this list.
 */
export function DeskList({
  list,
  canChange,
  today,
}: {
  list: DeskListView;
  canChange: boolean;
  today: string;
}) {
  const { handlers, dialogs } = useDeskDialogs({
    venueId: list.venueId,
    today,
    bookings: list.items,
  });
  if (list.items.length === 0) {
    return list.status === "upcoming" ? (
      <EmptyState
        size="compact"
        title="No visits to come"
        description="Booked collections appear here. Look at a day to book one for a client."
      />
    ) : (
      <EmptyState
        size="compact"
        title="Nothing to follow up"
        description="Visits marked not collected appear here until they are booked again."
      />
    );
  }
  const days = new Map<string, DeskListView["items"]>();
  for (const item of list.items) {
    const key = londonDateKey(new Date(item.start));
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  return (
    <div className="flex flex-col gap-4">
      {dialogs}
      <p className="text-staff-sm text-staff-muted">
        {list.items.length} {list.items.length === 1 ? "visit" : "visits"}
        {list.status === "not_collected" ? " to follow up" : " to come"}
      </p>
      {list.more ? (
        <Notice tone="info" title={`Showing the first ${list.items.length}`}>
          More are waiting. They appear here as these are followed up.
        </Notice>
      ) : null}
      <DeskColumnHeaders />
      {[...days.entries()].map(([day, items]) => (
        <section
          key={day}
          aria-labelledby={`day-${day}`}
          className="rounded-staff-md border border-staff-line bg-staff-surface"
        >
          <h3
            id={`day-${day}`}
            className="border-b border-staff-line px-4 py-2.5 text-staff-sm font-semibold text-staff-fg"
          >
            {deskDayLabel(day)}
          </h3>
          <ul className="px-4 py-4">
            {items.map((booking) => (
              <DeskVisitRow
                key={booking.id}
                booking={booking}
                canChange={canChange}
                handlers={handlers}
                showTime
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
