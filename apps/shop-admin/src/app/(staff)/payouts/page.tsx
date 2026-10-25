import { AdminFailedPage } from "@/components/admin-fetch-state";
import { PayoutList } from "@/components/payouts/payout-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { payoutsList } from "@/server/domain/sales-lists.vm";
import type { AdminPayoutList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Payouts" };

const EMPTY: AdminPayoutList = { items: [], nextCursor: null };

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = payoutsList.parse(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminPayoutList>(
      adminListPath("payouts", { cursor: state.cursor, query: payoutsList.apiQuery(state) }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Payouts" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <PayoutList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      canMarkPaid={capabilities.includes("payout.mark_paid")}
    />
  );
}
