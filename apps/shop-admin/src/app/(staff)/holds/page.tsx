import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { CreateStockHoldForm } from "@/components/admin-staff-action-forms.client";
import { StockHoldsStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { redirect } from "next/navigation";

type HoldList = {
  items: Array<{
    holdId: string;
    artworkTitle: string;
    editionNumber: number;
    status: string;
    expiresAt: string;
  }>;
  nextCursor: string | null;
};

export default async function HoldsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<HoldList>(adminListPath("stock-holds", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Stock holds</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Stock holds</h1>
      <div className="mb-6">
        <CreateStockHoldForm />
      </div>
      <StockHoldsStaffListTable items={result.data.items} />
      <AdminListCursorNav pathname="/holds" nextCursor={result.data.nextCursor} />
    </div>
  );
}
