import { AdminFailedPage } from "@/components/admin-fetch-state";
import { PayoutList } from "@/components/payouts/payout-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { duePayoutCount } from "@/server/domain/payout-list.vm";
import type { AdminPayoutList } from "@auction/shop-contracts";
import { MetaItem, PageHeader } from "@auction/staff-ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Payouts" };

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminPayoutList>(adminListPath("payouts", { cursor })),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Payouts" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];
  const due = duePayoutCount(result.data.items);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payouts"
        description="Money owed to artists and owners after a sale. Open a due payout to mark it paid once the transfer has been made."
        meta={<MetaItem label="Due on this page">{due}</MetaItem>}
      />
      <PayoutList
        page={result.data}
        cursor={cursor ?? null}
        canMarkPaid={capabilities.includes("payout.mark_paid")}
      />
    </div>
  );
}
