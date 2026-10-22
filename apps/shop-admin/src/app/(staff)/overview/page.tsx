import { AdminFailedPage } from "@/components/admin-fetch-state";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { loadEnquirySummary } from "@/server/application/load-enquiry-summary";
import { enquiryInboxHref } from "@/server/domain/enquiry-inbox.vm";
import type { AdminOverviewKpis } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const result = await fetchAdminJson<AdminOverviewKpis>("overview/kpis");
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Overview" status={result.status} />;
  }
  const kpis = result.data;
  const session = await loadAdminSession();
  const enquiries = await loadEnquirySummary(
    session.status === "ok" ? session.data.capabilities : [],
  );

  return (
    <div>
      <PageHeader
        title="Overview"
        description="What needs attention across lax.art and LAX Shop."
      />
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
        {enquiries ? (
          <div className="rounded-md border border-outline-variant p-4">
            <dt className="text-sm text-on-surface-variant">
              <Link
                href={enquiryInboxHref({}, { status: "new" })}
                className="underline underline-offset-4"
              >
                New enquiries
              </Link>
            </dt>
            <dd className="text-2xl font-semibold">{enquiries.newCount}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
