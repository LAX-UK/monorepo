import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { AuditStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminAuditEntry } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type AuditList = { items: AdminAuditEntry[]; nextCursor: string | null };

export const metadata = { title: "Audit log" };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<AuditList>(adminListPath("audit", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Audit log" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="A record of changes made by staff, newest first."
      />
      <AuditStaffListTable items={result.data.items} />
      <AdminListCursorNav pathname="/audit" cursor={cursor} nextCursor={result.data.nextCursor} />
    </div>
  );
}
