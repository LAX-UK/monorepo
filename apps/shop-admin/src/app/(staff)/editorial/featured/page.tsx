import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HomeFeaturesEditor } from "@/components/home-features/home-features-editor.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import type { AdminHomeCover, AdminHomeFeatures } from "@auction/shop-contracts";
import { HOME_COVER_EDIT_CAPABILITY, HOME_FEATURES_EDIT_CAPABILITY } from "@auction/shop-domain";
import { PageHeader, ViewOnlyBadge } from "@auction/staff-ui";
import { redirect } from "next/navigation";

const TITLE = "Featured on home";

export const metadata = { title: TITLE };

export default async function FeaturedOnHomePage() {
  const [features, cover, session] = await Promise.all([
    fetchAdminJson<AdminHomeFeatures>("home-features"),
    fetchAdminJson<AdminHomeCover>("home-cover"),
    loadAdminSession(),
  ]);
  if (
    features.status === "unauthorized" ||
    cover.status === "unauthorized" ||
    session.status === "unauthorized"
  ) {
    redirect("/login");
  }
  if (features.status !== "ok") {
    return <AdminFailedPage title={TITLE} status={features.status} />;
  }
  if (cover.status !== "ok") {
    return <AdminFailedPage title={TITLE} status={cover.status} />;
  }
  const canEdit =
    session.status === "ok" &&
    session.data.capabilities.includes(HOME_FEATURES_EDIT_CAPABILITY) &&
    session.data.capabilities.includes(HOME_COVER_EDIT_CAPABILITY);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs list={{ label: "Editorial", href: "/editorial" }} current={TITLE} />
        }
        title={TITLE}
        status={
          !canEdit && session.status === "ok" ? (
            <ViewOnlyBadge role={staffRoleLabel(session.data.role)} />
          ) : undefined
        }
        description="The cover image, prints, artists and categories the LAX Shop home features. The artists also lead on the lax.art home. Each part is saved on its own and goes live at once."
      />
      <HomeFeaturesEditor initial={features.data} cover={cover.data} canEdit={canEdit} />
    </div>
  );
}
