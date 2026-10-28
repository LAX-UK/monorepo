import { AuditLogList } from "@/components/admin/audit/audit-log-list";
import { auditActionOptions } from "@/lib/admin/audit/audit-action-options";
import { loadAdminAuditLogPage } from "@/lib/admin/audit/load-audit-log-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { AUDIT_DOMAIN_EVENTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Audit log",
  "Who did what across the platform, and when.",
);

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminCapability(AUDIT_DOMAIN_EVENTS_ACCESS, "/admin/audit");
  const sp = await searchParams;
  const { model, rows, pagination, loadError } = await loadAdminAuditLogPage(sp, {
    canOpenPlatformRoutes: canAccessPlatformAdminRoutes(user.role as UserRole, user.staffRoles),
  });

  return (
    <AuditLogList
      rows={rows}
      search={sp}
      filters={model.filters}
      chips={model.chips}
      clearAllHref={model.clearAllHref}
      actions={auditActionOptions()}
      pagination={pagination}
      loadError={loadError}
      filtered={model.chips.length > 0}
    />
  );
}
