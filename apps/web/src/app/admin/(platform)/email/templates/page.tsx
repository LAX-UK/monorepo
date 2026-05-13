import { AppScreen } from "@/components/dashboard/dashboard-page";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";

export default function AdminEmailTemplatesPage() {
  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Templates & tests"
        description="Preview MJML/React email layouts, send sandbox deliveries, and attach provider-specific metadata."
        className="border-0 pb-0"
      />
      <EmptyState
        title="Template studio forthcoming"
        description="Hook transactional renderer + seed fixtures before enabling merchant edits."
      />
    </AppScreen>
  );
}
