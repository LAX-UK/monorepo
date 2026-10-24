import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { AdminRecordTable } from "@/components/admin-staff-data-table";
import { RecordPossessionForm } from "@/components/forms/operations/record-possession-form.client";
import { FulfilmentUpdateForm } from "@/components/orders/order-actions.client";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { Section } from "@auction/staff-ui";
import { PageHeader } from "@auction/ui";
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

export const metadata = { title: "Fulfilment" };

export default async function ShopAdminFulfilmentPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; fulfilmentId?: string }>;
}) {
  const { cursor, fulfilmentId } = await searchParams;
  const result = await fetchAdminJson<FulfilmentList>(adminListPath("fulfilment", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Fulfilment" status={result.status} />;
  }

  const selectedFulfilmentId = fulfilmentId?.trim() || result.data.items[0]?.fulfilmentId;
  const selected = result.data.items.find((row) => row.fulfilmentId === selectedFulfilmentId);
  const fulfilmentFormProps = selectedFulfilmentId
    ? { defaultFulfilmentId: selectedFulfilmentId }
    : {};

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fulfilment"
        description="Track what is still to be shipped or collected, and record tracking and possession."
      />
      {selected ? (
        <Section
          title={`Update order ${selected.orderId.slice(0, 8)}`}
          description="Only the statuses this fulfilment can move to next are offered."
        >
          <FulfilmentUpdateForm fulfilment={selected} />
        </Section>
      ) : null}
      <RecordPossessionForm {...fulfilmentFormProps} />
      <section>
        <h2 className="mb-3 text-lg font-medium">Open fulfilments</h2>
        <AdminRecordTable
          ariaLabel="Open fulfilments"
          columns={["Order", "Status", "Option", "Tracking", "Updated", ""]}
          empty={{
            title: "Nothing to fulfil",
            description: "Paid orders that still need shipping or collection will appear here.",
          }}
          rows={result.data.items.map((row) => ({
            id: row.fulfilmentId,
            cells: [
              <Link key="order" href={`/orders/${row.orderId}`} className="underline">
                {row.orderId.slice(0, 8)}
              </Link>,
              row.status,
              row.option,
              row.trackingNumber ? `${row.carrier ?? "carrier"} ${row.trackingNumber}` : "—",
              formatAdminDetailDateTime(row.updatedAt),
              <Link
                key="edit"
                href={`/fulfilment?fulfilmentId=${encodeURIComponent(row.fulfilmentId)}`}
                className="underline"
              >
                Update
              </Link>,
            ],
          }))}
        />
        <AdminListCursorNav
          cursor={cursor}
          pathname="/fulfilment"
          nextCursor={result.data.nextCursor}
        />
      </section>
    </div>
  );
}
