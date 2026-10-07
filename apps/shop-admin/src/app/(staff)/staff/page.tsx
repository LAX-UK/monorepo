import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { GrantStaffRoleForm } from "@/components/admin-staff-action-forms.client";
import { StaffMembersListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
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

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<StaffList>(adminListPath("staff", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Staff</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Staff</h1>
      <div className="mb-6">
        <GrantStaffRoleForm />
      </div>
      <StaffMembersListTable items={result.data.items} />
      <AdminListCursorNav pathname="/staff" nextCursor={result.data.nextCursor} />
    </div>
  );
}
