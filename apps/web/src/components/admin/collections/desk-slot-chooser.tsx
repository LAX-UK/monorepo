"use client";

import { loadDeskDayAction } from "@/lib/actions/admin/admin-collection-desk";
import { deskDayLabel, placesLabel, timeRange } from "@/lib/admin/collections/desk.vm";
import {
  ChoiceRow,
  DateInput,
  Field,
  Notice,
  Skeleton,
  StaffButton,
  StaffRadio,
  StaffRadioGroup,
} from "@auction/staff-ui";
import type { DeskDayView, DeskGroupView } from "@auction/types";
import { useCallback, useEffect, useState } from "react";

export type ChosenSlot = { start: string; full: boolean } | null;

/**
 * The same time picker for a rebook and for booking on a client's behalf: choose a day, then a
 * time. A time that is full can still be chosen by staff, who then give a reason; a closed day
 * says so, and a sale day offers nothing here (open it on the day view).
 */
export function DeskSlotChooser({
  venueId,
  initialDate,
  value,
  onChange,
  error,
}: {
  venueId: string;
  initialDate: string;
  value: string | null;
  onChange: (slot: ChosenSlot) => void;
  error?: string | undefined;
}) {
  const [date, setDate] = useState(initialDate);
  const [day, setDay] = useState<DeskDayView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (target: string) => {
      setLoading(true);
      setFailed(false);
      const result = await loadDeskDayAction(venueId, target);
      setLoading(false);
      if (result.ok && result.data) setDay(result.data);
      else setFailed(true);
    },
    [venueId],
  );

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const groups: DeskGroupView[] = day?.groups ?? [];
  return (
    <div className="flex flex-col gap-3">
      <Field label="Day">
        <DateInput
          value={date}
          onValueChange={(next) => {
            if (!next) return;
            onChange(null);
            setDate(next);
          }}
        />
      </Field>
      <div aria-live="polite" className="flex flex-col gap-2">
        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : failed ? (
          <Notice
            tone="danger"
            title="We couldn't load the times"
            actions={
              <StaffButton variant="secondary" size="sm" onClick={() => load(date)}>
                Try again
              </StaffButton>
            }
          >
            {null}
          </Notice>
        ) : day && day.state !== "open" ? (
          <Notice tone="info" title={`${deskDayLabel(date)} is closed`}>
            {day.state === "sale_day"
              ? "It's a sale day. Open it anyway from the day view, then book."
              : "The gallery doesn't offer visits that day."}
          </Notice>
        ) : groups.length === 0 ? (
          <p className="text-staff-sm text-staff-muted">No times that day.</p>
        ) : (
          <StaffRadioGroup
            className="sm:grid-cols-2"
            aria-label="Time"
            value={value ?? ""}
            onValueChange={(start) => {
              const group = groups.find((g) => g.start === start);
              if (group) onChange({ start: group.start, full: group.taken >= group.capacity });
            }}
          >
            {groups.map((group) => {
              const full = group.taken >= group.capacity;
              const id = `slot-${group.start}`;
              return (
                <ChoiceRow
                  key={group.start}
                  htmlFor={id}
                  control={<StaffRadio id={id} value={group.start} />}
                  label={timeRange(group)}
                  description={full ? `${placesLabel(group)} · needs a reason` : placesLabel(group)}
                />
              );
            })}
          </StaffRadioGroup>
        )}
        {error ? <p className="text-staff-sm font-medium text-staff-danger">{error}</p> : null}
      </div>
    </div>
  );
}
