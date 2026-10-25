import { buildListHref } from "@/lib/admin/admin-list-params";
import { defineListSort } from "@/lib/admin/define-list-sort";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import {
  STAFF_DEFAULT_PAGE_SIZE,
  type StatusPresentation,
  parseStaffPageSize,
} from "@auction/staff-ui";
import type { OnsiteEventListItem } from "@auction/types";

export const EVENT_RSVPS_LIST_PATH = "/admin/event-rsvps";

export type EventRsvpsListSearch = Record<string, string | string[] | undefined>;

/** One onsite event as the staff list shows it; plain data for the client component. */
export type EventRsvpStaffRow = {
  slug: string;
  title: string;
  status: StatusPresentation;
  startsAt: string | null;
  rsvpCloseAt: string | null;
  rsvpCount: number;
  saleId: string | null;
  href: string;
  checkInHref: string;
  editHref: string;
  saleCheckInHref: string | null;
};

export const EVENT_STATUS_VIEWS = [
  { id: "published", label: "Published" },
  { id: "draft", label: "Draft" },
  { id: "closed", label: "RSVPs closed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

/** Latest start first, so upcoming and recent events lead; or by title or RSVP count. */
export const eventRsvpsSort = defineListSort(
  {
    event: { asc: "title_asc", desc: "title_desc" },
    starts: { asc: "starts_asc", desc: "starts_desc" },
    rsvps: { asc: "rsvps_asc", desc: "rsvps_desc" },
  },
  "starts_desc",
);

const str = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export function eventRsvpsListHref(
  current: EventRsvpsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  return buildListHref(EVENT_RSVPS_LIST_PATH, current, { offset: 0, event: null, ...patch });
}

/** The list with this event's panel open (`?event=`), or closed for null. */
export function eventRsvpPanelHref(current: EventRsvpsListSearch, slug: string | null): string {
  return buildListHref(EVENT_RSVPS_LIST_PATH, current, { event: slug });
}

function toRow(event: OnsiteEventListItem): EventRsvpStaffRow {
  const slug = encodeURIComponent(event.slug);
  return {
    slug: event.slug,
    title: event.title,
    status: staffStatus("onsiteEvent", event.status),
    startsAt: event.startsAt,
    rsvpCloseAt: event.rsvpCloseAt,
    rsvpCount: event.rsvpCount,
    saleId: event.saleId,
    href: `${EVENT_RSVPS_LIST_PATH}/${slug}`,
    checkInHref: `${EVENT_RSVPS_LIST_PATH}/${slug}/check-in`,
    editHref: `${EVENT_RSVPS_LIST_PATH}/${slug}/edit`,
    saleCheckInHref: event.saleId
      ? `/admin/sales/${encodeURIComponent(event.saleId)}/registrations`
      : null,
  };
}

function compare(a: EventRsvpStaffRow, b: EventRsvpStaffRow, columnId: string): number {
  if (columnId === "event") return a.title.localeCompare(b.title, "en-GB");
  if (columnId === "rsvps") return a.rsvpCount - b.rsvpCount;
  // Events with no start time yet sort after every dated event, either way round.
  if (!a.startsAt || !b.startsAt) return a.startsAt ? -1 : b.startsAt ? 1 : 0;
  return a.startsAt.localeCompare(b.startsAt);
}

/**
 * The events list for one URL: the status view, the search, the sort and the page. The API
 * returns every event at once, so the server applies the query here before rendering.
 */
export function queryEventRsvps(events: readonly OnsiteEventListItem[], sp: EventRsvpsListSearch) {
  const status = str(sp.status);
  const q = str(sp.q).toLocaleLowerCase("en-GB");
  const sort = eventRsvpsSort.state(str(sp.sort));
  const limit = parseStaffPageSize(str(sp.limit) || STAFF_DEFAULT_PAGE_SIZE);
  const offset = Math.max(0, Number.parseInt(str(sp.offset), 10) || 0);

  const all = events.map(toRow);
  const counts: Record<string, number> = { all: all.length };
  for (const view of EVENT_STATUS_VIEWS) {
    counts[view.id] = events.filter((event) => event.status === view.id).length;
  }
  const matching = all
    .filter((_row, index) => !status || events[index]?.status === status)
    .filter((row) => !q || row.title.toLocaleLowerCase("en-GB").includes(q) || row.slug.includes(q))
    .sort((a, b) => {
      const order = compare(a, b, sort.columnId);
      const dated = sort.columnId !== "starts" || (a.startsAt && b.startsAt);
      return dated && sort.direction === "desc" ? -order : order;
    });
  const rows = matching.slice(offset, offset + limit);

  return {
    rows,
    counts,
    total: matching.length,
    limit,
    offset,
    status,
    q: str(sp.q),
    sort,
    totalRsvps: events.reduce((sum, event) => sum + event.rsvpCount, 0),
    prevHref: offset > 0 ? eventRsvpsListHref(sp, { offset: Math.max(0, offset - limit) }) : null,
    nextHref:
      offset + limit < matching.length ? eventRsvpsListHref(sp, { offset: offset + limit }) : null,
  };
}
