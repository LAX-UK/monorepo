import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { DeliveryRegionsEditor } from "@/components/delivery-regions/delivery-regions-editor.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import type { AdminDeliveryRegions } from "@auction/shop-contracts";
import { DELIVERY_REGIONS_EDIT_CAPABILITY } from "@auction/shop-domain";
import { PageHeader, ViewOnlyBadge } from "@auction/staff-ui";
import { redirect } from "next/navigation";

const TITLE = "Delivery regions";

export const metadata = { title: TITLE };

export default async function DeliveryRegionsPage() {
  const [regions, session] = await Promise.all([
    fetchAdminJson<AdminDeliveryRegions>("delivery-regions"),
    loadAdminSession(),
  ]);
  if (regions.status === "unauthorized" || session.status === "unauthorized") {
    redirect("/login");
  }
  if (regions.status !== "ok") {
    return <AdminFailedPage title={TITLE} status={regions.status} />;
  }
  const canEdit =
    session.status === "ok" && session.data.capabilities.includes(DELIVERY_REGIONS_EDIT_CAPABILITY);

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
        description="Where LAX delivers, how long it takes and what it costs. Changes apply to new quotes at once."
      />
      <DeliveryRegionsEditor initial={regions.data} canEdit={canEdit} />
    </div>
  );
}
