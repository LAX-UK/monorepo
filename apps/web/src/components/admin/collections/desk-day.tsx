"use client";

import { addCollectionExceptionAction } from "@/lib/actions/admin/admin-collections";
import { collectionsHref } from "@/lib/admin/collections/collections.vm";
import {
  deskDayLabel,
  nextDay,
  placesLabel,
  previousDay,
  timeRange,
} from "@/lib/admin/collections/desk.vm";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import {
  DateInput,
  EmptyState,
  Field,
  Notice,
  StaffButton,
  StaffButtonLink,
  StatusBadge,
} from "@auction/staff-ui";
import { ChevronLeft, ChevronRight } from "@auction/staff-ui/icons";
import type { DeskDayView } from "@auction/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeskBookForClientDialog } from "./desk-book-for-client-dialog";
import { DeskVisitRow } from "./desk-visit-row";
import { useDeskDialogs } from "./use-desk-dialogs";

/**
 * One day at the desk: visits grouped by time with the places taken ("2 of 2 booked"), who is
 * coming, and what is ready. A closed day says why, and a sale day can be opened anyway.
 */
export function DeskDay({
  day,
  canChange,
  today,
}: {
  day: DeskDayView;
  canChange: boolean;
  today: string;
}) {
  const router = useRouter();
  const { handlers, dialogs } = useDeskDialogs({ venueId: day.venueId, today });
  const [booking, setBooking] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openFailure, setOpenFailure] = useState<string | null>(null);
  const href = (date: string) => collectionsHref("day", day.venueId, date);
  const visits = day.groups.reduce((sum, group) => sum + group.bookings.length, 0);

  async function openAnyway() {
    setOpening(true);
    setOpenFailure(null);
    const result = await addCollectionExceptionAction(day.venueId, {
      kind: "extra_opening",
      startsOn: day.date,
      endsOn: day.date,
      opensLocal: null,
      closesLocal: null,
      reason: "Opened from the day view",
    });
    setOpening(false);
    if (result.ok) router.refresh();
    else if (!handleStaffStepUp(result)) setOpenFailure(result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <StaffButtonLink
            href={href(previousDay(day.date))}
            Link={Link}
            variant="secondary"
            aria-label="Previous day"
            icon={<ChevronLeft aria-hidden />}
          />
          <Field label="Day" labelHidden>
            <DateInput
              value={day.date}
              onValueChange={(next) => {
                if (next) router.push(href(next));
              }}
              className="w-44"
            />
          </Field>
          <StaffButtonLink
            href={href(nextDay(day.date))}
            Link={Link}
            variant="secondary"
            aria-label="Next day"
            icon={<ChevronRight aria-hidden />}
          />
          {day.date === today ? null : (
            <StaffButtonLink href={href(today)} Link={Link} variant="ghost">
              Today
            </StaffButtonLink>
          )}
        </div>
        {canChange ? (
          <StaffButton variant="primary" onClick={() => setBooking(true)}>
            Book for a client
          </StaffButton>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-staff-lg font-semibold text-staff-fg">{deskDayLabel(day.date)}</h2>
        {day.state === "open" ? (
          <p className="text-staff-sm text-staff-muted">
            {visits === 0
              ? "No visits booked"
              : `${visits} ${visits === 1 ? "visit" : "visits"} · ${day.toHandOver} to hand over`}
            {` · ${day.openTimes} ${day.openTimes === 1 ? "time" : "times"} still open`}
          </p>
        ) : (
          <StatusBadge tone="neutral">
            {day.state === "sale_day" ? "Sale day" : "Closed"}
          </StatusBadge>
        )}
      </div>

      {openFailure ? (
        <Notice tone="danger" title={openFailure} alert>
          {null}
        </Notice>
      ) : null}
      {dialogs}

      {day.state !== "open" && visits === 0 ? (
        <EmptyState
          size="compact"
          title={day.state === "sale_day" ? "Closed for a sale day" : "Closed this day"}
          description={
            day.state === "sale_day"
              ? "Collections close on sale days while the saleroom is set up."
              : "The gallery doesn't offer visits on this day."
          }
          action={
            day.canOpenAnyway && canChange ? (
              <StaffButton variant="secondary" onClick={openAnyway} loading={opening}>
                Open this day anyway
              </StaffButton>
            ) : undefined
          }
        />
      ) : visits === 0 ? (
        <EmptyState
          size="compact"
          title="No visits booked"
          description={`${day.openTimes} ${day.openTimes === 1 ? "time is" : "times are"} still open on this day.`}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {day.groups
            .filter((group) => group.bookings.length > 0)
            .map((group) => (
              <li
                key={group.start}
                className="rounded-staff-md border border-staff-line bg-staff-surface"
              >
                <section aria-labelledby={`group-${group.start}`}>
                  <header className="flex items-center justify-between gap-3 border-b border-staff-line px-4 py-2.5">
                    <h3
                      id={`group-${group.start}`}
                      className="text-staff-sm font-semibold text-staff-fg"
                    >
                      {timeRange(group)}
                    </h3>
                    <span className="text-staff-xs text-staff-muted">{placesLabel(group)}</span>
                  </header>
                  <ul className="px-4 py-4">
                    {group.bookings.map((booking) => (
                      <DeskVisitRow
                        key={booking.id}
                        booking={booking}
                        canChange={canChange}
                        handlers={handlers}
                      />
                    ))}
                  </ul>
                </section>
              </li>
            ))}
        </ul>
      )}

      <DeskBookForClientDialog
        open={booking}
        venueId={day.venueId}
        today={today}
        onClose={() => setBooking(false)}
      />
    </div>
  );
}
