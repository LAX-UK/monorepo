import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { PrintPartiesPanel } from "@/components/settings/print-parties-panel.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import type { AdminPrintPartyList } from "@auction/shop-contracts";
import { PageHeader, ViewOnlyBadge } from "@auction/staff-ui";
import { redirect } from "next/navigation";

const TITLE = "Printers and publishers";

export const metadata = { title: TITLE };

export default async function PrintersAndPublishersPage() {
  const [list, session] = await Promise.all([
    fetchAdminJson<AdminPrintPartyList>("print-parties"),
    loadAdminSession(),
  ]);
  if (list.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (list.status !== "ok") return <AdminFailedPage title={TITLE} status={list.status} />;
  const canEdit = session.status === "ok" && session.data.capabilities.includes("settings.write");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs list={{ label: "Settings", href: "/settings" }} current={TITLE} />
        }
        title={TITLE}
        status={
          !canEdit && session.status === "ok" ? (
            <ViewOnlyBadge role={staffRoleLabel(session.data.role)} />
          ) : undefined
        }
        description="The studios and publishers edition facts are described by."
      />
      <div className="flex w-full max-w-[720px] flex-col gap-6">
        <PrintPartiesPanel parties={list.data.items} canEdit={canEdit} />
      </div>
    </div>
  );
}
