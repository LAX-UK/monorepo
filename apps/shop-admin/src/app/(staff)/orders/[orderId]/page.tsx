import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { CancelOrderLineForm, RefundOrderForm } from "@/components/admin-staff-action-forms.client";
import { AdminRecordTable } from "@/components/admin-staff-data-table";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminOrderDetail } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const result = await fetchAdminJson<AdminOrderDetail>(`orders/${orderId}`);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <AdminFailedPage title="Order" status={result.status} />;
  }
  const data = result.data;
  const orderLineOptions = data.lines.map((line) => ({
    orderLineId: line.orderLineId,
    label: `${line.artworkTitle ?? line.orderLineId.slice(0, 8)}${
      line.editionNumber == null ? "" : ` · ed. ${line.editionNumber}`
    }`,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: "Orders", href: "/orders" }}
            current={`Order ${data.orderId.slice(0, 8)}`}
          />
        }
        title={`Order ${data.orderId.slice(0, 8)}`}
        description={`${data.status} · ${formatAdminDetailGbpPence(data.totalPence)} · ${data.fulfilment}${
          data.paidAt ? ` · Paid ${formatAdminDetailDateTime(data.paidAt)}` : ""
        }`}
      />

      <section>
        <h2 className="mb-3 text-lg font-medium">Lines</h2>
        <AdminRecordTable
          ariaLabel="Order lines"
          columns={["Line", "Edition", "Unit price"]}
          empty={{ title: "No lines", description: "This order has no lines." }}
          rows={data.lines.map((row) => ({
            id: row.orderLineId,
            cells: [
              row.artworkTitle ?? row.orderLineId.slice(0, 8),
              row.editionNumber == null ? "—" : String(row.editionNumber),
              formatAdminDetailGbpPence(row.unitPricePence),
            ],
          }))}
        />
      </section>

      {data.fulfilmentRecord ? (
        <section>
          <h2 className="mb-3 text-lg font-medium">Fulfilment</h2>
          <p className="text-sm">
            {data.fulfilmentRecord.status} · {data.fulfilmentRecord.option}
            {data.fulfilmentRecord.trackingNumber
              ? ` · ${data.fulfilmentRecord.carrier ?? "carrier"} ${data.fulfilmentRecord.trackingNumber}`
              : ""}
          </p>
        </section>
      ) : null}

      {orderLineOptions.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <CancelOrderLineForm orderLineOptions={orderLineOptions} />
          <RefundOrderForm orderId={data.orderId} orderLineOptions={orderLineOptions} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-medium">Refunds</h2>
        <AdminRecordTable
          ariaLabel="Refunds"
          columns={["Amount", "Status", "Source", "Created"]}
          empty={{
            title: "No refunds",
            description: "Refunds issued against this order will be listed here.",
          }}
          rows={data.refunds.map((row) => ({
            id: row.refundId,
            cells: [
              formatAdminDetailGbpPence(row.amountPence),
              row.status,
              row.source,
              formatAdminDetailDateTime(row.createdAt),
            ],
          }))}
        />
      </section>
    </div>
  );
}
