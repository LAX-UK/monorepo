import { AppScreen } from "@/components/dashboard/dashboard-page";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";

export default function AdminCmsHomePage() {
  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Content management"
        description="Legal pages, homepage hero, featured sales/artists, and announcement ribbons with draft → preview → publish."
        className="border-0 pb-0"
      />
      <EmptyState
        title="CMS tables pending"
        description="cms_page migration unlocks inline editing tied to ISR revalidation hooks."
      />
    </AppScreen>
  );
}
