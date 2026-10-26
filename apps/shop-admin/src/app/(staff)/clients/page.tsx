import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ClientsList } from "@/components/clients/clients-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import { clientsList } from "@/server/domain/people-lists.vm";
import type { AdminPartyList } from "@auction/shop-contracts";
import { clientListScope } from "@auction/shop-domain";
import { redirect } from "next/navigation";

export const metadata = { title: "Clients" };

const EMPTY: AdminPartyList = { items: [], nextCursor: null };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = clientsList.parse(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminPartyList>(
      adminListPath("clients", { cursor: state.cursor, query: clientsList.apiQuery(state) }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Clients" status={result.status} />;
  }

  return (
    <ClientsList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      assignedOnly={
        session.status === "ok" && clientListScope(session.data.capabilities) === "assigned"
      }
      bidPublicUrl={getShopAdminContainer().config.bidPublicUrl || undefined}
    />
  );
}
