import { AdminFailedPage } from "@/components/admin-fetch-state";
import { DisputesList } from "@/components/disputes/disputes-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { disputeOrderHref, disputesList } from "@/server/domain/sales-lists.vm";
import type { AdminDisputeList, AdminDisputeListItem } from "@auction/shop-contracts";
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

  // A link to the dispute panel that used to be here (`?dispute=`) opens the dispute's order.
  if (state.open) {
    const linked = await findDispute(state.open, result.status === "ok" ? result.data : EMPTY);
    if (linked) redirect(disputesList.recordHref(state, disputeOrderHref(linked)));
  }

  return (
    <DisputesList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
    />
  );
}

/**
 * The dispute an old panel link named: on the page shown, else among the newest of every status.
 * Disputes are few, so a dispute old enough to be past those simply leaves the list in view.
 */
async function findDispute(
  disputeId: string,
  shown: AdminDisputeList,
): Promise<AdminDisputeListItem | null> {
  const onPage = shown.items.find((item) => item.disputeId === disputeId);
  if (onPage) return onPage;
  const all = await fetchAdminJson<AdminDisputeList>(
    adminListPath("disputes", { query: { limit: "100" } }),
  );
  return all.status === "ok"
    ? (all.data.items.find((item) => item.disputeId === disputeId) ?? null)
    : null;
}
