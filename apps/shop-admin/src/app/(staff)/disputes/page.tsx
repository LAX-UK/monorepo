import { AdminFailedPage } from "@/components/admin-fetch-state";
import { DisputesList } from "@/components/disputes/disputes-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { disputesList } from "@/server/domain/sales-lists.vm";
import type { AdminDisputeList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Disputes" };

const EMPTY: AdminDisputeList = { items: [], nextCursor: null };

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = disputesList.parse(await searchParams);
  const result = await fetchAdminJson<AdminDisputeList>(
    adminListPath("disputes", { cursor: state.cursor, query: disputesList.apiQuery(state) }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Disputes" status={result.status} />;
  }

  return (
    <DisputesList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
    />
  );
}
