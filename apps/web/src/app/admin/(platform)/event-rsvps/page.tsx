import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { getAdminOnsiteEvents } from "@/lib/data/http/onsite-event.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Plus, ScanLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Event RSVPs",
  "Manage guest lists, passes, and check-in for invitation-only events.",
);

export default async function AdminEventRsvpsPage() {
  let events: Awaited<ReturnType<typeof getAdminOnsiteEvents>> = [];
  let loadError: string | null = null;

  try {
    events = await getAdminOnsiteEvents();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load event RSVPs.";
  }

  const totalRsvps = events.reduce((sum, event) => sum + event.rsvpCount, 0);
  const publishedCount = events.filter((event) => event.status === "published").length;

  const empty =
    !loadError && events.length === 0 ? (
      <AdminEmptyState
        title="No events yet"
        description="Invitation-only events appear here once they are registered in the platform."
      />
    ) : null;

  return (
    <AdminListShell
      layout="hub"
      title="Event RSVPs"
      description="Manage guest lists, passes, and check-in for invitation-only events. For live bidding, use Saleroom."
      kpiStrip={
        !loadError ? (
          <AdminListKpiStrip
            ariaLabel="Event RSVPs summary"
            tiles={[
              { label: "Events", value: events.length },
              { label: "Published", value: publishedCount },
              { label: "Total RSVPs", value: totalRsvps },
            ]}
          />
        ) : null
      }
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "events", label: "Events", value: String(events.length) },
              { id: "published", label: "Published", value: String(publishedCount) },
              { id: "rsvps", label: "RSVPs", value: String(totalRsvps) },
            ]}
          />
        ) : null
      }
      errorAlert={
        loadError ? (
          <AdminListAlert title="Could not load events">{loadError}</AdminListAlert>
        ) : null
      }
      view={
        <div className="space-y-8">
          <AdminHubQuickLinks
            ariaLabel="Event RSVPs quick links"
            links={[
              { href: "/admin/event-rsvps/new", label: "Create event" },
              { href: "/admin/saleroom", label: "Saleroom console" },
              { href: "/admin/sales", label: "Sales" },
              { href: "/admin/invitations", label: "Invitations" },
            ]}
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" asChild>
              <Link href="/admin/event-rsvps/new">
                <Plus className="mr-2 size-4" />
                Create event
              </Link>
            </Button>
          </div>
          {!loadError && events.length > 0 ? (
            <Surface className="divide-y divide-border-hairline">
              {events.map((event) => (
                <div
                  key={event.slug}
                  className="flex flex-wrap items-center justify-between gap-4 p-4"
                >
                  <Link
                    href={`/admin/event-rsvps/${encodeURIComponent(event.slug)}`}
                    className="min-w-0 flex-1 space-y-1 transition-colors hover:text-on-surface"
                  >
                    <p className="font-medium">{event.title}</p>
                    <p className="font-body text-xs text-on-surface-variant">{event.slug}</p>
                    {event.startsAt ? (
                      <p className="font-body text-xs text-on-surface-variant">
                        Starts {formatDateTime(event.startsAt)}
                      </p>
                    ) : null}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge domain="onsiteEvent" status={event.status} />
                    <span className="font-body text-xs text-on-surface-variant">
                      {event.rsvpCount} RSVP{event.rsvpCount === 1 ? "" : "s"}
                    </span>
                    {event.saleId ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link
                          href={`/admin/sales/${encodeURIComponent(event.saleId)}/registrations`}
                        >
                          Sale check-in
                        </Link>
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href={`/admin/event-rsvps/${encodeURIComponent(event.slug)}/check-in`}>
                        <ScanLine className="mr-2 size-4" />
                        Check-in
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </Surface>
          ) : null}
        </div>
      }
      empty={empty}
    />
  );
}
