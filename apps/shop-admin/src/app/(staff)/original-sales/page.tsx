import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import {
  CreateOriginalSaleForm,
  IssueOriginalSaleInvoiceForm,
} from "@/components/admin-staff-action-forms.client";
import { AdminRecordTable } from "@/components/admin-staff-data-table";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type OriginalSaleList = {
  items: Array<{
    saleId: string;
    artworkId: string;
    artworkTitle: string;
    status: string;
    salePricePence: number;
    createdAt: string;
  }>;
  nextCursor: string | null;
};

export const metadata = { title: "Original sales" };

export default async function ShopAdminOriginalSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<OriginalSaleList>(
    adminListPath("original-sales", { cursor }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Original sales" status={result.status} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Original sales"
        description="Sell the original of an artwork: reserve it, issue the buyer an invoice, and it is assigned once they pay."
      />
      <CreateOriginalSaleForm />
      <IssueOriginalSaleInvoiceForm />
      <section>
        <h2 className="mb-3 text-lg font-medium">Pipeline</h2>
        <AdminRecordTable
          ariaLabel="Original sales pipeline"
          columns={["Sale ID", "Artwork", "Price", "Status", "Created"]}
          empty={{
            title: "No original sales yet",
            description:
              "Create a sale with the form above and it will appear here as it moves towards payment.",
          }}
          rows={result.data.items.map((row) => ({
            id: row.saleId,
            cells: [
              row.saleId,
              row.artworkTitle,
              formatAdminDetailGbpPence(row.salePricePence),
              row.status,
              formatAdminDetailDateTime(row.createdAt),
            ],
          }))}
        />
        <AdminListCursorNav
          cursor={cursor}
          pathname="/original-sales"
          nextCursor={result.data.nextCursor}
        />
      </section>
    </div>
  );
}
