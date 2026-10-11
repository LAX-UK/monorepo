import { AdminFetchState } from "@/components/admin-fetch-state";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminDisputeListItem } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

type DisputeList = { items: AdminDisputeListItem[]; nextCursor: string | null };

function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export default async function DisputesPage() {
  const result = await fetchAdminJson<DisputeList>("disputes?limit=50");
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Disputes</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Disputes</h1>
      <ul className="space-y-2 text-sm">
        {result.data.items.map((row) => (
          <li key={row.disputeId} className="rounded-md border border-outline-variant p-3">
            <span className="font-medium">{row.status}</span> · {formatPence(row.amountPence)} ·
            order {row.orderId.slice(0, 8)}… · Stripe {row.stripeDisputeId}
          </li>
        ))}
        {result.data.items.length === 0 ? <li>No disputes recorded.</li> : null}
      </ul>
    </div>
  );
}
