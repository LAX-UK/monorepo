import { RailSection } from "@/components/admin/detail-rail/rail-section";
import { relativeFromIso } from "@/lib/admin/relative-time";
import Link from "next/link";

export type ActivitySnapshotItem = {
  id: string;
  label: string;
  at: string;
  actor?: string | null;
};

type Props = {
  events: readonly ActivitySnapshotItem[];
  title?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
};

/** Last few activity events — full timeline remains on the Activity tab. */
export function ActivitySnapshotRail({
  events,
  title = "Recent activity",
  viewAllHref,
  viewAllLabel = "View all",
}: Props) {
  const snapshot = events.slice(0, 5);

  return (
    <RailSection title={title}>
      {snapshot.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No recent activity.</p>
      ) : (
        <ol className="space-y-2">
          {snapshot.map((event) => (
            <li
              key={event.id}
              className="rounded-md border border-border-hairline/50 bg-surface-container-low/40 px-3 py-2"
            >
              <p className="font-body text-sm text-on-surface">{event.label}</p>
              <p className="mt-0.5 font-body text-xs text-on-surface-variant">
                {relativeFromIso(event.at)}
                {event.actor ? ` · ${event.actor}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="inline-block font-label text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          {viewAllLabel} →
        </Link>
      ) : null}
    </RailSection>
  );
}
