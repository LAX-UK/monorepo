import { AdminUserTimeline } from "@/components/admin/admin-user-timeline";
import type { AdminDomainEventRow, AdminUserActivityEntry } from "@/lib/data/http/admin.server";

export function AdminUserActivityPanel({
  sessions,
  domainEvents,
}: {
  sessions: AdminUserActivityEntry[];
  domainEvents: AdminDomainEventRow[];
}) {
  return (
    <AdminUserTimeline
      sessions={sessions}
      domainEvents={domainEvents}
      emptyTitle="No activity"
      emptyDescription="This user has no recorded sign-in sessions or account events yet."
    />
  );
}

export function AdminUserAuditLogPanel({
  sessions,
  domainEvents,
}: {
  sessions: AdminUserActivityEntry[];
  domainEvents: AdminDomainEventRow[];
}) {
  return (
    <AdminUserTimeline
      sessions={sessions}
      domainEvents={domainEvents}
      auditOnly
      emptyTitle="No audit events"
      emptyDescription="No admin or auth events recorded for this account yet."
    />
  );
}
