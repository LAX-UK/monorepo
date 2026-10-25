"use client";

import { useGuestActions } from "@/components/admin/event-rsvps/use-guest-actions";
import { staffArrivalStatus } from "@/lib/admin/staff-kit-status";
import {
  type DataColumn,
  DataTable,
  DataTableToolbar,
  EmptyState,
  EmptyValue,
  FilterMenu,
  NoResultsState,
  PrimaryCell,
  Section,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
  rowActionsColumn,
} from "@auction/staff-ui";
import type { OnsiteEventRsvpAdminRow, OnsiteEventSegmentOption } from "@auction/types";
import { useMemo, useState } from "react";

type ArrivalFilter = "arrived" | "pending";

type Props = {
  slug: string;
  rsvps: readonly OnsiteEventRsvpAdminRow[];
  segmentOptions: readonly OnsiteEventSegmentOption[];
};

/** The attendance option by its name; an option removed from the event reads as "Other". */
export function segmentLabel(options: readonly OnsiteEventSegmentOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? "Other";
}

/** Who is coming with the guest. */
export function partyLabel(row: Pick<OnsiteEventRsvpAdminRow, "plusOne" | "plusOneGuestName">) {
  if (row.plusOne <= 0) return "Guest only";
  const name = row.plusOneGuestName?.trim();
  return name ? `Plus-one: ${name}` : "Plus-one";
}

function matchesSearch(row: OnsiteEventRsvpAdminRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.name, row.email, row.plusOneGuestName ?? "", row.notes ?? ""].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

/**
 * The event's guests: search, an arrival filter, and a `…` menu per guest. Resending a pass asks
 * first, because the guest receives an email and an older link may stop working.
 */
export function OnsiteEventGuestList({ slug, rsvps, segmentOptions }: Props) {
  const [query, setQuery] = useState("");
  const [arrival, setArrival] = useState<ArrivalFilter[]>([]);
  const guestActions = useGuestActions(slug);

  const visible = useMemo(
    () =>
      rsvps.filter((row) => {
        if (!matchesSearch(row, query)) return false;
        if (arrival.length !== 1) return true;
        return arrival[0] === "arrived" ? row.checkedInAt !== null : row.checkedInAt === null;
      }),
    [rsvps, query, arrival],
  );

  const arrivedCount = rsvps.filter((row) => row.checkedInAt !== null).length;
  const filtered = query.trim() !== "" || arrival.length > 0;

  const columns: DataColumn<OnsiteEventRsvpAdminRow>[] = [
    {
      id: "guest",
      header: "Guest",
      mobile: "title",
      sortable: true,
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => <PrimaryCell secondary={row.email}>{row.name}</PrimaryCell>,
    },
    {
      id: "segment",
      header: "Attending",
      mobile: "meta",
      sortable: true,
      sortValue: (row) => segmentLabel(segmentOptions, row.attendanceSegment).toLowerCase(),
      cell: (row) => segmentLabel(segmentOptions, row.attendanceSegment),
    },
    {
      id: "party",
      header: "Party",
      hideBelow: "md",
      mobile: "meta",
      cell: (row) => partyLabel(row),
    },
    {
      id: "arrival",
      header: "Arrival",
      width: "128px",
      truncate: false,
      mobile: "badge",
      sortable: true,
      sortValue: (row) => (row.checkedInAt ? 1 : 0),
      cell: (row) => {
        const status = staffArrivalStatus(row.checkedInAt !== null);
        return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
      },
    },
    {
      id: "arrived-at",
      header: "Arrived at",
      width: "192px",
      hideBelow: "lg",
      mobile: "hidden",
      truncate: false,
      cell: (row) => <StaffDate value={row.checkedInAt} withTime />,
    },
    {
      id: "notes",
      header: "Notes",
      hideBelow: "xl",
      mobile: "hidden",
      cell: (row) => row.notes?.trim() || <EmptyValue />,
    },
    rowActionsColumn<OnsiteEventRsvpAdminRow>({
      actions: guestActions.actionsFor,
      label: (row) => `Actions for ${row.name}`,
    }),
  ];

  const clear = () => {
    setQuery("");
    setArrival([]);
  };

  return (
    <>
      <Section
        title="Guest list"
        description={`${arrivedCount} of ${rsvps.length} arrived`}
        bodyClassName="p-0"
      >
        <DataTable
          label="Guest list"
          className="rounded-none border-0"
          columns={columns}
          data={visible}
          getRowId={(row) => row.id}
          defaultSort={{ columnId: "guest", direction: "asc" }}
          toolbar={
            <DataTableToolbar
              search={
                <TableSearch
                  live
                  value={query}
                  onSearch={setQuery}
                  placeholder="Search by name, email or note"
                  label="Search guests"
                />
              }
              filters={
                <FilterMenu
                  label="Arrival"
                  options={[
                    {
                      value: "arrived",
                      label: "Arrived",
                      count: arrivedCount,
                    },
                    {
                      value: "pending",
                      label: "Not arrived",
                      count: rsvps.length - arrivedCount,
                    },
                  ]}
                  selected={arrival}
                  onChange={(values) => setArrival(values as ArrivalFilter[])}
                />
              }
            />
          }
          empty={
            filtered ? (
              <NoResultsState
                title="No guests match"
                description="Try a different search, or clear the filters."
                action={
                  <StaffButton size="sm" onClick={clear}>
                    Clear search and filters
                  </StaffButton>
                }
              />
            ) : (
              <EmptyState
                title="No RSVPs yet"
                description="Guests appear here once they respond to their invitation."
              />
            )
          }
        />
      </Section>
      {guestActions.dialogs}
    </>
  );
}
