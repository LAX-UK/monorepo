"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  EVENT_STATUS_VIEWS,
  type EventRsvpStaffRow,
  type EventRsvpsListSearch,
  eventRsvpsListHref,
  eventRsvpsSort,
} from "@/lib/admin/events/event-rsvps-staff-list.vm";
import { listQueryOf } from "@/lib/admin/list-record";
import {
  type DataColumn,
  DataViews,
  ListPage,
  type Metric,
  type OverflowAction,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
  formatStaffNumber,
  recordHrefInList,
  searchChipLabel,
} from "@auction/staff-ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

export type EventRsvpsStaffListProps = {
  rows: EventRsvpStaffRow[];
  search: EventRsvpsListSearch;
  counts: Record<string, number>;
  metrics: Metric[];
  sort: { columnId: string; direction: "asc" | "desc" };
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
  filtered: boolean;
};

const str = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/** The event's own pages; `pageHref` is its guest list, still in this list. */
function rowActions(row: EventRsvpStaffRow, pageHref: string): OverflowAction[] {
  return [
    { id: "page", label: "Open guest list", href: pageHref },
    { id: "check-in", label: "Check in", href: row.checkInHref },
    { id: "edit", label: "Edit event", href: row.editHref },
    ...(row.saleCheckInHref
      ? [{ id: "sale", label: "Open sale check-in", href: row.saleCheckInHref }]
      : []),
  ];
}

/**
 * Invitation-only onsite events on the staff list template: views by status with counts, search
 * by title, and latest start first (sortable by title and RSVPs). A row opens the event's guest
 * list, which keeps this list's query for Previous and Next; Back returns to the list as it was.
 * Every row's `…` menu leads to the guest list, the door check-in and the editor.
 */
export function EventRsvpsStaffList(props: EventRsvpsStaffListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const listQuery = useMemo(() => listQueryOf(search, ["event"]), [search]);
  const recordHref = useCallback(
    (row: EventRsvpStaffRow) => recordHrefInList(row.href, listQuery),
    [listQuery],
  );
  const status = str(search.status);
  const q = str(search.q);

  const columns = useMemo<DataColumn<EventRsvpStaffRow>[]>(
    () => [
      {
        id: "event",
        header: "Event",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "asc",
        cell: (row) => (
          <PrimaryCell href={recordHref(row)} Link={Link}>
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "148px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>,
      },
      {
        id: "rsvps",
        header: "RSVPs",
        width: "104px",
        numeric: true,
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => formatStaffNumber(row.rsvpCount),
      },
      {
        id: "starts",
        header: "Starts",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => (row.startsAt ? <StaffDate value={row.startsAt} withTime /> : null),
      },
      {
        id: "closes",
        header: "RSVPs close",
        width: "184px",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => (row.rsvpCloseAt ? <StaffDate value={row.rsvpCloseAt} withTime /> : null),
      },
    ],
    [recordHref],
  );

  const views = [{ id: "all", label: "All" }, ...EVENT_STATUS_VIEWS].map((view) => ({
    id: view.id,
    label: view.label,
    href: eventRsvpsListHref(search, { status: view.id === "all" ? null : view.id }),
    count: props.counts[view.id] ?? 0,
  }));

  return (
    <ListPage<EventRsvpStaffRow>
      title="Event RSVPs"
      description="Guest lists, passes and door check-in for invitation-only events. Live bidding runs in Saleroom."
      Link={ListLink}
      listKey="bid-admin.event-rsvps"
      primaryAction={
        <StaffButton asChild variant="primary" size="sm" icon={<Plus aria-hidden />}>
          <Link href="/admin/event-rsvps/new">New event</Link>
        </StaffButton>
      }
      secondaryActions={
        <StaffButton asChild variant="secondary" size="sm">
          <Link href="/admin/saleroom">Saleroom</Link>
        </StaffButton>
      }
      metrics={{ label: "Events summary", period: "All events", items: props.metrics }}
      views={<DataViews views={views} activeId={status || "all"} Link={ListLink} />}
      search={
        <TableSearch
          key={q}
          fullWidth
          label="Search events"
          placeholder="Search by event title"
          value={q}
          onSearch={(next) => navigate(eventRsvpsListHref(search, { q: next || null }))}
        />
      }
      activeFilters={
        q
          ? [
              {
                id: "q",
                label: searchChipLabel(q),
                onRemove: () => navigate(eventRsvpsListHref(search, { q: null })),
              },
            ]
          : []
      }
      onClearFilters={() => navigate(eventRsvpsListHref(search, { q: null }))}
      loading={pending}
      filtered={filtered}
      error={
        props.loadError
          ? {
              title: "Events did not load",
              description: props.loadError,
              onRetry: () => navigate(eventRsvpsListHref(search, {})),
            }
          : null
      }
      empty={{
        title: status ? "No events in this view" : "Create your first event",
        description: status
          ? "Events move here as their status changes."
          : "Set up an invitation-only event, share its RSVP page, then check guests in at the door.",
        ...(status
          ? {}
          : {
              action: (
                <StaffButton asChild size="sm" variant="primary">
                  <Link href="/admin/event-rsvps/new">New event</Link>
                </StaffButton>
              ),
            }),
      }}
      noResults={{ noun: "events" }}
      table={{
        columns,
        data: rows,
        getRowId: (row) => row.slug,
        defaultHiddenColumns: ["closes"],
        defaultSort: eventRsvpsSort.defaultSort,
        sort: props.sort,
        onSortChange: (sort) =>
          navigate(eventRsvpsListHref(search, { sort: eventRsvpsSort.param(sort) })),
        rowHref: recordHref,
        rowActions: {
          label: (row) => `Actions for ${row.title}`,
          actions: (row) => rowActions(row, recordHref(row)),
        },
      }}
      pageSize={{
        value: props.pageSize,
        onChange: (size) => navigate(eventRsvpsListHref(search, { limit: size })),
      }}
      pagination={props.pagination}
    />
  );
}
