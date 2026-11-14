import { buildAdminClientDetailTabs } from "@/components/admin/admin-client-detail-tabs";
import { PeopleDetailShell } from "@/components/admin/people-detail-shell";
import { loadAdminClientDetail } from "@/lib/admin/load-admin-client-detail";
import { loadPeopleRecordPager } from "@/lib/admin/people/load-people-record-pager";
import { peopleListHrefFromRecord } from "@/lib/admin/people/people-record-href";
import { getAdminUserById } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const listHref = peopleListHrefFromRecord("/admin/clients", sp);
  const [bundle, pager] = await Promise.all([
    loadAdminClientDetail(id),
    loadPeopleRecordPager("/admin/clients", id, sp),
  ]);

  return (
    <PeopleDetailShell
      user={bundle.user}
      listHref={listHref}
      listLabel="Clients"
      pager={pager}
      access={{
        canModerate: bundle.canModerate,
        canManageRoles: bundle.canManageRoles,
        emailChange: bundle.emailChange,
      }}
      attentionItems={bundle.attentionItems}
      legalEntitiesForActions={bundle.legalEntitiesForActions}
      tabs={buildAdminClientDetailTabs(bundle)}
    />
  );
}
