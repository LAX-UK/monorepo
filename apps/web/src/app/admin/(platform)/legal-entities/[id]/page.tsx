import { LegalEntityDetailShell } from "@/components/admin/legal-entities/legal-entity-detail-shell";
import { statusLabel } from "@/lib/admin/legal-entity-list-presenter";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminLegalEntityById, getAdminUserById } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
  searchParams: Promise<{ error?: string; success?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);
  const activeTab = sp.tab === "stripe" || sp.tab === "lifecycle" ? sp.tab : "overview";

  let entity: Awaited<ReturnType<typeof getAdminLegalEntityById>> = null;
  try {
    entity = await getAdminLegalEntityById(id);
  } catch {
    notFound();
  }
  if (!entity) {
    notFound();
  }

  const creatorUser = await getAdminUserById(entity.createdByUserId).catch(() => null);
  const creator = creatorUser
    ? { id: creatorUser.id, name: creatorUser.name, email: creatorUser.email }
    : null;

  return (
    <LegalEntityDetailShell
      entity={entity}
      creator={creator}
      activeTab={activeTab}
      error={error}
      success={success}
    />
  );
}
