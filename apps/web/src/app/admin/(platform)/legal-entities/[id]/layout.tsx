import { LegalEntityDetailShell } from "@/components/admin/legal-entities/legal-entity-detail-shell";
import { loadListRecordPager, requestListQuery } from "@/lib/admin/list-record-pager.server";
import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";
import {
  LEGAL_ENTITIES_LIST_PATH,
  legalEntityHref,
} from "@/lib/admin/people/legal-entities-staff-list.vm";
import { loadLegalEntitiesListIds } from "@/lib/admin/people/load-legal-entities-list-page";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminLegalEntityDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const listQuery = await requestListQuery();
  const [bundle, pager] = await Promise.all([
    loadAdminLegalEntityDetail(id),
    // Opened from the legal entities list: Previous and Next through that list.
    loadListRecordPager({
      listQuery,
      currentId: id,
      recordHref: legalEntityHref,
      loadIds: loadLegalEntitiesListIds,
    }),
  ]);

  return (
    <LegalEntityDetailShell
      bundle={bundle}
      backHref={listQuery ? `${LEGAL_ENTITIES_LIST_PATH}?${listQuery}` : LEGAL_ENTITIES_LIST_PATH}
      pager={pager}
    >
      {children}
    </LegalEntityDetailShell>
  );
}
