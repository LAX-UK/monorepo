import { AdminFailedPage } from "@/components/admin-fetch-state";
import { FramingCatalogue } from "@/components/framing/framing-catalogue.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import type { FramingOptionList } from "@auction/shop-contracts";
import { FRAMING_EDIT_CAPABILITY } from "@auction/shop-domain";
import { redirect } from "next/navigation";

const TITLE = "Framing";

export const metadata = { title: TITLE };

export default async function FramingPage() {
  const [catalogue, session] = await Promise.all([
    fetchAdminJson<FramingOptionList>("framing-options"),
    loadAdminSession(),
  ]);
  if (catalogue.status === "unauthorized" || session.status === "unauthorized") {
    redirect("/login");
  }
  if (catalogue.status !== "ok") {
    return <AdminFailedPage title={TITLE} status={catalogue.status} />;
  }
  const canEdit =
    session.status === "ok" && session.data.capabilities.includes(FRAMING_EDIT_CAPABILITY);

  return (
    <FramingCatalogue
      options={catalogue.data.items}
      canEdit={canEdit}
      {...(session.status === "ok" ? { viewOnlyRole: staffRoleLabel(session.data.role) } : {})}
    />
  );
}
