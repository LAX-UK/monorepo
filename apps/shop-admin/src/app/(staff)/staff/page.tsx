import { AdminFailedPage } from "@/components/admin-fetch-state";
import { StaffList } from "@/components/staff/staff-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import { staffList } from "@/server/domain/people-lists.vm";
import type { AdminStaffMemberList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Staff" };

const EMPTY: AdminStaffMemberList = { items: [], nextCursor: null };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = staffList.parse(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminStaffMemberList>(
      adminListPath("staff", { cursor: state.cursor, query: staffList.apiQuery(state) }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Staff" status={result.status} />;
  }

  const { bidPublicUrl } = getShopAdminContainer().config;
  return (
    <StaffList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      currentSubject={session.status === "ok" ? session.data.subject : ""}
      bidStaffUrl={bidPublicUrl ? `${bidPublicUrl}/admin/staff` : undefined}
    />
  );
}
