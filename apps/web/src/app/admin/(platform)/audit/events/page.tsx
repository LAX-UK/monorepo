import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";

export default function AdminAuditEventsPage() {
  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Domain events"
        description="Filter actionable audit entries by aggregate, actor, correlation id, and payload diff previews."
        className="border-0 pb-0"
      />
      <EmptyState
        title="Feed empty"
        description="Once domain_events indexes roll forward, rows render here with replay gated behind feature flags."
      />
    </div>
  );
}
