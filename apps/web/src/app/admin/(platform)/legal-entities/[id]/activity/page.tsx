import { LegalEntityActivityTab } from "@/components/admin/legal-entities/tabs/activity-tab";
import { loadAdminLegalEntityActivityPage } from "@/lib/admin/legal-entities/load-legal-entity-activity-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLegalEntityActivityPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminLegalEntityActivityPage(id);
  return (
    <LegalEntityActivityTab
      entity={page.entity}
      activityEvents={page.activityEvents}
      canViewActivity={page.canViewActivity}
    />
  );
}
