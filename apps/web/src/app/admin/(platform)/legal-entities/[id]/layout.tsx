import { LegalEntityDetailAlerts } from "@/components/admin/legal-entities/legal-entity-detail-alerts";
import { LegalEntityDetailShell } from "@/components/admin/legal-entities/legal-entity-detail-shell";
import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminLegalEntityDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const bundle = await loadAdminLegalEntityDetail(id);

  return (
    <LegalEntityDetailShell bundle={bundle} backHref="/admin/legal-entities">
      <Suspense fallback={null}>
        <LegalEntityDetailAlerts />
      </Suspense>
      {children}
    </LegalEntityDetailShell>
  );
}
