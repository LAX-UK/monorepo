import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { SaleAuthorityRequestsStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
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
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Sale limit requests</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Sale limit requests</h1>
      <SaleAuthorityRequestsStaffListTable items={result.data.items} />
      <AdminListCursorNav pathname="/requests" nextCursor={result.data.nextCursor} />
    </div>
  );
}
