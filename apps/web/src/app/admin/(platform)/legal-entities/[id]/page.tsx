import { LegalEntityDetailShell } from "@/components/admin/legal-entities/legal-entity-detail-shell";
import { parseAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { statusLabel } from "@/lib/admin/legal-entity-list-presenter";
import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const entity = await getAdminLegalEntityById(id).catch(() => null);
  return metadataForPrivate(
    entity?.displayName ?? "Legal entity",
    entity
      ? `${entity.kind} / ${entity.subkind} · ${statusLabel(entity.status)}`
      : "Legal entity detail",
  );
}

export default async function AdminLegalEntityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; tab?: string; returnTo?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const backHref = parseAdminListReturnTarget(sp.returnTo, "/admin/legal-entities");
  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);
  const activeTab =
    sp.tab === "stripe" || sp.tab === "lifecycle" || sp.tab === "documents" || sp.tab === "activity"
      ? sp.tab
      : "overview";

  const { entity, creator, documents, activityEvents } = await loadAdminLegalEntityDetail(id);

  return (
    <LegalEntityDetailShell
      entity={entity}
      creator={creator}
      activeTab={activeTab}
      documents={documents}
      activityEvents={activityEvents}
      error={error}
      success={success}
      backHref={backHref}
    />
  );
}
