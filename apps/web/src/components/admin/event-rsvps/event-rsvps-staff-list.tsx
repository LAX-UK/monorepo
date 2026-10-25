"use client";

import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  EVENT_STATUS_VIEWS,
  type EventRsvpStaffRow,
  type EventRsvpsListSearch,
  eventRsvpPanelHref,
  eventRsvpsListHref,
  eventRsvpsSort,
} from "@/lib/admin/events/event-rsvps-staff-list.vm";
import {
  type DataColumn,
  DataViews,
  DetailPanel,
  ListPage,
  type Metric,
  type OverflowAction,
  OverflowMenu,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowUpRight, Plus, ScanLine } from "lucide-react";
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

function rowActions(row: EventRsvpStaffRow): OverflowAction[] {
  return [
    { id: "page", label: "Open guest list", href: row.href },
    { id: "check-in", label: "Open check-in", href: row.checkInHref },
    { id: "edit", label: "Edit event", href: row.editHref },
    ...(row.saleCheckInHref
      ? [{ id: "sale", label: "Open sale check-in", href: row.saleCheckInHref }]
      : []),
  ];
}

/**
 * Invitation-only onsite events on the staff list template: views by status with counts, search
 * by title, latest start first (sortable by title and RSVPs), and a record panel deep-linked with
 * `?event=` that leads to the guest list and the door check-in.
 */
export function EventRsvpsStaffList(props: EventRsvpsStaffListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const panelHref = useCallback(
    (slug: string | null) => eventRsvpPanelHref(search, slug),
    [search],
  );
  const panel = useListPanel({
    param: "event",
    initialId: str(search.event) || null,
    hrefFor: panelHref,
  });
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
          <PrimaryCell href={panelHref(row.slug)} Link={panel.PanelLink}>
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
        cell: (row) => row.rsvpCount.toLocaleString("en-GB"),
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
    [panelHref, panel.PanelLink],
  );

  const views = [{ id: "all", label: "All" }, ...EVENT_STATUS_VIEWS].map((view) => ({
    id: view.id,
    label: view.label,
    href: eventRsvpsListHref(search, { status: view.id === "all" ? null : view.id }),
    count: props.counts[view.id] ?? 0,
  }));
  const open = rows.find((row) => row.slug === panel.openId) ?? null;

  return (
    <>
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
                  label: `Search: ${q}`,
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
        noResults={{
          title: "No events match",
          description: "Try another title, or clear the search.",
        }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.slug,
          defaultHiddenColumns: ["closes"],
          defaultSort: eventRsvpsSort.defaultSort,
          sort: props.sort,
          onSortChange: (sort) =>
            navigate(eventRsvpsListHref(search, { sort: eventRsvpsSort.param(sort) })),
          onRowOpen: (row) => panel.show(row.slug),
          activeRowId: panel.openId,
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.slug) },
              ...rowActions(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(eventRsvpsListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <EventRsvpQuickView row={open} onClose={() => panel.show(null)} />
    </>
  );
}

/** One event beside the list: when it is, how many are coming, and the way to its guest list. */
export function EventRsvpQuickView({
  row,
  onClose,
}: {
  row: EventRsvpStaffRow | null;
  onClose: () => void;
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.title ?? "Event"}
      status={row ? <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge> : null}
      meta={row ? [{ label: "RSVPs", value: row.rsvpCount.toLocaleString("en-GB") }] : []}
      overflow={
        row ? (
          <OverflowMenu
            label={`More actions for ${row.title}`}
            actions={rowActions(row).filter((action) => action.id !== "page")}
          />
        ) : null
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ScanLine aria-hidden />}>
            <Link href={row.checkInHref}>Check-in</Link>
          </StaffButton>
        ) : null
      }
      summary={
        row
          ? [
              {
                label: "Starts",
                value: row.startsAt
                  ? formatStaffDateTime(row.startsAt, { zoneLabel: true })
                  : "Not set",
              },
              {
                label: "RSVPs close",
                value: row.rsvpCloseAt
                  ? formatStaffDateTime(row.rsvpCloseAt, { zoneLabel: true })
                  : "Not set",
              },
              { label: "Linked sale", value: row.saleId ? "Yes, with sale check-in" : "None" },
              { label: "Event address", value: row.slug, copyValue: row.slug },
            ]
          : []
      }
      footer={
        row ? (
          <StaffButton asChild variant="primary" icon={<ArrowUpRight aria-hidden />}>
            <Link href={row.href}>Open guest list</Link>
          </StaffButton>
        ) : null
      }
    >
      {null}
    </DetailPanel>
  );
}
