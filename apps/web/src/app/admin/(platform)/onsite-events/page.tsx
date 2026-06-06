import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { getAdminOnsiteEvents } from "@/lib/data/http/onsite-event.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { formatDateTime } from "@/lib/ui/format";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { ScanLine } from "lucide-react";
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

  const totalRsvps = events.reduce((sum, event) => sum + event.rsvpCount, 0);
  const publishedCount = events.filter((event) => event.status === "published").length;

  const empty =
    !loadError && events.length === 0 ? (
      <AdminEmptyState
        title="No onsite events"
        description="Events appear here once they are registered in the platform."
      />
    ) : null;

  return (
    <AdminListShell
      layout="hub"
      title="Onsite events"
      description="RSVP operations for invitation-only onsite events."
      showCommandPaletteHint
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
        !loadError && events.length > 0 ? (
          <Surface className="divide-y divide-border-hairline">
            {events.map((event) => (
              <div
                key={event.slug}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <Link
                  href={`/admin/onsite-events/${encodeURIComponent(event.slug)}`}
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
                  <Badge variant="secondary">{event.status}</Badge>
                  <Badge variant="outline">
                    {event.rsvpCount} RSVP{event.rsvpCount === 1 ? "" : "s"}
                  </Badge>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={`/admin/onsite-events/${encodeURIComponent(event.slug)}/check-in`}>
                      <ScanLine className="mr-2 size-4" />
                      Check-in
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </Surface>
        ) : null
      }
      empty={empty}
    />
  );
}
