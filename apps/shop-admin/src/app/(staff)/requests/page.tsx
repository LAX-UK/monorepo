import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { SaleAuthorityRequestsStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type RequestList = {
  items: Array<{
    requestId: string;
    artworkTitle: string;
    ownerDisplayName: string;
    requestedCount: number;
    status: string;
  }>;
  nextCursor: string | null;
};

export const metadata = { title: "Sale limit requests" };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<RequestList>(
    adminListPath("sale-authority-requests", {
      cursor,
      query: { status: "pending" },
    }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Sale limit requests" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Sale limit requests"
        description="Owners asking to sell more editions than they are authorised for. Approve or decline each request."
      />
      <SaleAuthorityRequestsStaffListTable items={result.data.items} />
      <AdminListCursorNav
        cursor={cursor}
        pathname="/requests"
        nextCursor={result.data.nextCursor}
      />
    </div>
  );
}
