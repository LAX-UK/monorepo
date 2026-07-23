import { buildAdminClientDetailTabs } from "@/components/admin/admin-client-detail-tabs";
import { AdminUserDetailShell } from "@/components/admin/admin-user-detail-shell";
import { parseAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { loadAdminClientDetail } from "@/lib/admin/load-admin-client-detail";
import { getAdminUserById } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getAdminUserById(id).catch(() => null);
  return metadataForPrivate(
    user?.name ?? "Client",
    user ? `${user.email} · Client detail` : "Client detail",
  );
}

export default async function AdminClientDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const listHref = parseAdminListReturnTarget(sp.returnTo, "/admin/clients");
  const bundle = await loadAdminClientDetail(id);

  return (
    <AdminUserDetailShell
      user={bundle.user}
      listHref={listHref}
      listLabel="Clients"
      attentionItems={bundle.attentionItems}
      railContext={bundle.railContext}
      summaryMetrics={bundle.summaryMetrics}
      legalEntitiesForActions={bundle.legalEntitiesForActions}
      showAccountControls={bundle.canManageRoles}
      showDangerZone={bundle.canModerate}
      tabs={buildAdminClientDetailTabs(bundle)}
    />
  );
}
