import { EventRsvpsStaffList } from "@/components/admin/event-rsvps/event-rsvps-staff-list";
import {
  EVENT_RSVPS_LIST_PATH,
  queryEventRsvps,
} from "@/lib/admin/events/event-rsvps-staff-list.vm";
import { loadAdminEventRsvpsHubPage } from "@/lib/admin/events/load-event-rsvps-hub-page";
import { peopleRangeSummary } from "@/lib/admin/people/clients-staff-list.vm";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Event RSVPs",
  "Manage guest lists, passes, and check-in for invitation-only events.",
);

export default async function AdminEventRsvpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { events, publishedCount, loadError } = await loadAdminEventRsvpsHubPage();
  const result = queryEventRsvps(events, sp);
  const now = Date.now();
  const upcoming = events.filter(
    (event) => event.startsAt && new Date(event.startsAt).getTime() > now,
  ).length;

  return (
    <EventRsvpsStaffList
      rows={result.rows}
      search={sp}
      counts={result.counts}
      metrics={[
        { id: "upcoming", label: "Upcoming", value: upcoming.toLocaleString("en-GB") },
        {
          id: "published",
          label: "Published",
          value: publishedCount.toLocaleString("en-GB"),
          href: `${EVENT_RSVPS_LIST_PATH}?status=published`,
        },
        {
          id: "rsvps",
          label: "RSVPs, all events",
          value: result.totalRsvps.toLocaleString("en-GB"),
        },
      ]}
      sort={result.sort}
      pageSize={result.limit}
      pagination={
        result.rows.length > 0
          ? {
              summary: peopleRangeSummary(result.offset, result.rows.length, result.total, {
                one: "event",
                other: "events",
              }),
              prevHref: result.prevHref,
              nextHref: result.nextHref,
            }
          : null
      }
      loadError={loadError}
      filtered={result.q !== ""}
    />
  );
}
