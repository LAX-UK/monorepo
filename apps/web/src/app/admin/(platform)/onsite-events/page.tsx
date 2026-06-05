import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { getAdminOnsiteEvents } from "@/lib/data/http/onsite-event.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { formatDateTime } from "@/lib/ui/format";
import { Badge } from "@auction/ui/components/badge";
import { Surface } from "@auction/ui/components/surface";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Onsite events",
  "Manage RSVPs for onsite events.",
);

export default async function AdminOnsiteEventsPage() {
  let events: Awaited<ReturnType<typeof getAdminOnsiteEvents>> = [];
  let loadError: string | null = null;

  try {
    events = await getAdminOnsiteEvents();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load onsite events.";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl tracking-tight">Onsite events</h1>
        <p className="font-body text-sm text-on-surface-variant">
          RSVP operations for invitation-only onsite events.
        </p>
      </div>

      {loadError ? <AdminListAlert>{loadError}</AdminListAlert> : null}

      {events.length === 0 && !loadError ? (
        <AdminEmptyState
          title="No onsite events"
          description="Events appear here once they are registered in the platform."
        />
      ) : (
        <Surface className="divide-y divide-border-hairline">
          {events.map((event) => (
            <Link
              key={event.slug}
              href={`/admin/onsite-events/${encodeURIComponent(event.slug)}`}
              className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-container-low/40"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{event.title}</p>
                <p className="font-body text-xs text-on-surface-variant">{event.slug}</p>
                {event.startsAt ? (
                  <p className="font-body text-xs text-on-surface-variant">
                    Starts {formatDateTime(event.startsAt)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{event.status}</Badge>
                <Badge variant="outline">{event.rsvpCount} RSVPs</Badge>
              </div>
            </Link>
          ))}
        </Surface>
      )}
    </div>
  );
}
