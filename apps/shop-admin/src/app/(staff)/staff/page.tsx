import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { StaffDirectory } from "@/components/staff/staff-directory.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import type { AdminStaffMemberList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Staff" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminStaffMemberList>(adminListPath("staff", { cursor })),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Staff" status={result.status} />;
  }

  const { bidPublicUrl } = getShopAdminContainer().config;
  return (
    <StaffDirectory
      members={result.data.items}
      currentSubject={session.status === "ok" ? session.data.subject : ""}
      bidStaffUrl={bidPublicUrl ? `${bidPublicUrl}/admin/staff` : undefined}
      now={new Date().toISOString()}
      footer={
        cursor || result.data.nextCursor ? (
          <AdminListCursorNav
            cursor={cursor}
            pathname="/staff"
            nextCursor={result.data.nextCursor}
          />
        ) : undefined
      }
    />
  );
}
