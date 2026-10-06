import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import {
  RecordPossessionForm,
  UpdateFulfilmentForm,
} from "@/components/admin-staff-action-forms.client";
import { AdminTable } from "@/components/shop-admin-shell";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import Link from "next/link";
import { redirect } from "next/navigation";

type FulfilmentList = {
  items: Array<{
    fulfilmentId: string;
    orderId: string;
    status: string;
    option: string;
    carrier: string | null;
    trackingNumber: string | null;
    updatedAt: string;
  }>;
  nextCursor: string | null;
};

export default async function ShopAdminFulfilmentPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; fulfilmentId?: string }>;
}) {
  const { cursor, fulfilmentId } = await searchParams;
  const result = await fetchAdminJson<FulfilmentList>(adminListPath("fulfilment", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Fulfilment</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  const selectedFulfilmentId = fulfilmentId?.trim() || result.data.items[0]?.fulfilmentId;
  const fulfilmentFormProps = selectedFulfilmentId
    ? { defaultFulfilmentId: selectedFulfilmentId }
    : {};

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Fulfilment</h1>
      <UpdateFulfilmentForm {...fulfilmentFormProps} />
      <RecordPossessionForm {...fulfilmentFormProps} />
      <section>
        <h2 className="mb-3 text-lg font-medium">Open fulfilments</h2>
        <AdminTable
          columns={["Order", "Status", "Option", "Tracking", "Updated", ""]}
          rows={result.data.items.map((row) => [
            <Link
              key={`${row.fulfilmentId}-order`}
              href={`/orders/${row.orderId}`}
              className="underline"
            >
              {row.orderId.slice(0, 8)}
            </Link>,
            row.status,
            row.option,
            row.trackingNumber ? `${row.carrier ?? "carrier"} ${row.trackingNumber}` : "—",
            formatAdminDetailDateTime(row.updatedAt),
            <Link
              key={`${row.fulfilmentId}-edit`}
              href={`/fulfilment?fulfilmentId=${encodeURIComponent(row.fulfilmentId)}`}
              className="underline"
            >
              Use in forms
            </Link>,
          ])}
        />
        <AdminListCursorNav pathname="/fulfilment" nextCursor={result.data.nextCursor} />
      </section>
    </div>
  );
}
