import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { ThirdPartySalesStaffListTable } from "@/components/admin-staff-list-tables.client";
import { ApproveSaleFeeForm } from "@/components/forms/sales/approve-sale-fee-form.client";
import { RecordThirdPartySaleForm } from "@/components/forms/sales/record-third-party-sale-form.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type ThirdPartySaleList = {
  items: Array<{
    saleId: string;
    artworkTitle: string;
    editionNumber: number;
    status: string;
    grossPence: number;
  }>;
  nextCursor: string | null;
};

export const metadata = { title: "Third-party sales" };

export default async function ThirdPartySalesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<ThirdPartySaleList>(
    adminListPath("third-party-sales", { cursor }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Third-party sales" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Third-party sales"
        description="Sales made through partners outside the shop, and the fee approved for each."
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <RecordThirdPartySaleForm />
        <ApproveSaleFeeForm />
      </div>
      <ThirdPartySalesStaffListTable items={result.data.items} />
      <AdminListCursorNav
        cursor={cursor}
        pathname="/third-party-sales"
        nextCursor={result.data.nextCursor}
      />
    </div>
  );
}
