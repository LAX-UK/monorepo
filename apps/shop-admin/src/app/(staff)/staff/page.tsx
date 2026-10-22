import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { StaffMembersListTable } from "@/components/admin-staff-list-tables.client";
import { GrantStaffRoleForm } from "@/components/forms/people/grant-staff-role-form.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type StaffList = {
  items: Array<{
    staffMemberId: string;
    identitySubjectId: string;
    role: string;
    disabledAt: string | null;
  }>;
  nextCursor: string | null;
};

export const metadata = { title: "Staff" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<StaffList>(adminListPath("staff", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Staff" status={result.status} />;
  }

  const { bidPublicUrl } = getShopAdminContainer().config;
  const bidStaffUrl = bidPublicUrl ? `${bidPublicUrl}/admin/staff` : undefined;

  return (
    <div>
      <PageHeader
        title="Staff"
        description="People who can sign in to LAX Admin, and the role each one holds."
      />
      <div className="mb-6">
        <GrantStaffRoleForm bidStaffUrl={bidStaffUrl} />
      </div>
      <StaffMembersListTable items={result.data.items} />
      <AdminListCursorNav cursor={cursor} pathname="/staff" nextCursor={result.data.nextCursor} />
    </div>
  );
}
