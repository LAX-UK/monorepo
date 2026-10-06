import { loadAdminList } from "@/lib/admin-data.server";

export default async function OverviewPage() {
  const kpis = await loadAdminList<{
    fulfilmentOpenCount: number;
    payoutsDueCount: number;
    activeHoldsCount: number;
    pendingAuthorityRequestsCount: number;
  }>("overview/kpis");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Overview</h1>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["To fulfil", kpis?.fulfilmentOpenCount ?? "—"],
          ["Payouts due", kpis?.payoutsDueCount ?? "—"],
          ["Active holds", kpis?.activeHoldsCount ?? "—"],
          ["Pending limit requests", kpis?.pendingAuthorityRequestsCount ?? "—"],
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
