import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { CreateStockHoldForm } from "@/components/admin-staff-action-forms.client";
import { StockHoldsStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
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

export const metadata = { title: "Stock holds" };

export default async function HoldsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<HoldList>(adminListPath("stock-holds", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Stock holds" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Stock holds"
        description="Editions held back for a client. A hold expires on its own; release one early if the sale falls through."
      />
      <div className="mb-6">
        <CreateStockHoldForm />
      </div>
      <StockHoldsStaffListTable items={result.data.items} />
      <AdminListCursorNav cursor={cursor} pathname="/holds" nextCursor={result.data.nextCursor} />
    </div>
  );
}
