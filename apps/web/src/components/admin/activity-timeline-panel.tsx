import { AdminUserTimeline } from "@/components/admin/admin-user-timeline";
import { getAdminDomainEvents } from "@/lib/data/http/admin.server";
import Link from "next/link";

type Props = {
  aggregateType: string;
  aggregateId: string;
  limit?: number;
};

/** Embedded audit activity for entity detail tabs (lots, sales, artists, etc.). */
export async function ActivityTimelinePanel({ aggregateType, aggregateId, limit = 25 }: Props) {
  let events: Awaited<ReturnType<typeof getAdminDomainEvents>> = [];
  let loadError: string | null = null;
  try {
    events = await getAdminDomainEvents({
      aggregateType,
      aggregateId,
      limit,
      offset: 0,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load activity.";
  }

  if (loadError) {
    return <p className="font-body text-sm text-destructive">{loadError}</p>;
  }

  return (
    <div className="space-y-4">
      <AdminUserTimeline
        sessions={[]}
        domainEvents={events}
        auditOnly
        emptyTitle="No activity yet"
        emptyDescription="Domain events for this record will appear here."
      />
      <Link
        href={`/admin/audit/timeline?aggregateType=${encodeURIComponent(aggregateType)}&aggregateId=${encodeURIComponent(aggregateId)}`}
        className="inline-flex font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
      >
        Open full audit timeline ↗
      </Link>
    </div>
  );
}
