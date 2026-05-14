import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { EmptyState } from "@auction/ui/components/empty-state";

export default function AdminCmsHomePage() {
  return (
    <AdminPanelPage
      title="Content management"
      description="Legal pages, homepage hero, featured sales/artists, and announcement ribbons with draft → preview → publish."
    >
      <EmptyState
        title="CMS tables pending"
        description="cms_page migration unlocks inline editing tied to ISR revalidation hooks."
      />
    </AdminPanelPage>
  );
}
