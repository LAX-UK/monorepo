import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { EmptyState } from "@auction/ui/components/empty-state";

export default function AdminAuditWebhooksPage() {
  return (
    <AdminPanelPage
      title="Webhook deliveries"
      description="Retry flows, signature validation, and latency histograms for partner integrations."
    >
      <EmptyState
        title="No webhook attempts"
        description="Connect outbound webhook providers to populate this ledger."
      />
    </AdminPanelPage>
  );
}
