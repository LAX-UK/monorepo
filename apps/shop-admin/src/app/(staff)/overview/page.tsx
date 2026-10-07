import { AdminFetchState } from "@/components/admin-fetch-state";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminOverviewKpis } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export default async function OverviewPage() {
  const result = await fetchAdminJson<AdminOverviewKpis>("overview/kpis");
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Overview</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }
  const kpis = result.data;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Overview</h1>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["To fulfil", kpis.fulfilmentOpenCount],
          ["Payouts due", kpis.payoutsDueCount],
          ["Active holds", kpis.activeHoldsCount],
          ["Pending limit requests", kpis.pendingAuthorityRequestsCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-outline-variant p-4">
            <dt className="text-sm text-on-surface-variant">{label}</dt>
            <dd className="text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
