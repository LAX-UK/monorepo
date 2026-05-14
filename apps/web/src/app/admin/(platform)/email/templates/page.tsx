import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { EmptyState } from "@auction/ui/components/empty-state";

export default function AdminEmailTemplatesPage() {
  return (
    <AdminPanelPage
      title="Templates & tests"
      description="Preview MJML/React email layouts, send sandbox deliveries, and attach provider-specific metadata."
    >
      <EmptyState
        title="Template studio forthcoming"
        description="Hook transactional renderer + seed fixtures before enabling merchant edits."
      />
    </AdminPanelPage>
  );
}
