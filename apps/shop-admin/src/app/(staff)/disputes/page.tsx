import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { DisputesStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminDisputeListItem } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type DisputeList = { items: AdminDisputeListItem[]; nextCursor: string | null };

export const metadata = { title: "Disputes" };

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<DisputeList>(adminListPath("disputes", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Disputes" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Disputes"
        description="Card disputes raised with the payment provider, newest first."
      />
      <DisputesStaffListTable items={result.data.items} />
      <AdminListCursorNav
        pathname="/disputes"
        cursor={cursor}
        nextCursor={result.data.nextCursor}
      />
    </div>
  );
}
