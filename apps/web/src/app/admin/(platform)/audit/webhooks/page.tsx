import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";

export default function AdminAuditWebhooksPage() {
  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Webhook deliveries"
        description="Retry flows, signature validation, and latency histograms for partner integrations."
        className="border-0 pb-0"
      />
      <EmptyState
        title="No webhook attempts"
        description="Connect outbound webhook providers to populate this ledger."
      />
    </div>
  );
}
