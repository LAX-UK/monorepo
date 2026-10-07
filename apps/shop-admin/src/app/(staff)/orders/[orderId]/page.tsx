import { CancelOrderLineForm, RefundOrderForm } from "@/components/admin-staff-action-forms.client";
import { AdminTable } from "@/components/shop-admin-shell";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminOrderDetail } from "@auction/shop-contracts";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const result = await fetchAdminJson<AdminOrderDetail>(`orders/${orderId}`);
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <p className="text-sm text-red-700">Could not load order ({result.status}).</p>;
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
      <div>
        <Link href="/orders" className="text-sm text-neutral-600 underline">
          ← Orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Order {data.orderId.slice(0, 8)}</h1>
        <p className="text-sm text-neutral-600">
          {data.status} · {formatAdminDetailGbpPence(data.totalPence)} · {data.fulfilment}
        </p>
        {data.paidAt ? (
          <p className="text-sm text-neutral-600">Paid {formatAdminDetailDateTime(data.paidAt)}</p>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Lines</h2>
        <AdminTable
          columns={["Line", "Edition", "Unit price"]}
          rows={data.lines.map((row) => [
            row.artworkTitle ?? row.orderLineId.slice(0, 8),
            row.editionNumber == null ? "—" : String(row.editionNumber),
            formatAdminDetailGbpPence(row.unitPricePence),
          ])}
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
        <AdminTable
          columns={["Amount", "Status", "Source", "Created"]}
          rows={data.refunds.map((row) => [
            formatAdminDetailGbpPence(row.amountPence),
            row.status,
            row.source,
            formatAdminDetailDateTime(row.createdAt),
          ])}
        />
      </section>
    </div>
  );
}
