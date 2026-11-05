import { AdminFailedPage } from "@/components/admin-fetch-state";
import { NeedsDecisionList, NewFromZohoList } from "@/components/from-zoho/from-zoho-list.client";
import { LastCheckView } from "@/components/from-zoho/last-check-view.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { loadBidAdminUrl } from "@/server/application/load-bid-admin-url";
import { getShopAdminContainer } from "@/server/container";
import {
  activeZohoTab,
  parseZohoQueueQuery,
  zohoQueueApiQuery,
} from "@/server/domain/zoho-register.vm";
import type {
  AdminRegisterConflictList,
  AdminRegisterLastCheck,
  AdminRegisterNewList,
} from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "From Zoho" };

const TITLE = "From Zoho";

export default async function FromZohoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseZohoQueueQuery(await searchParams);
  const tab = activeZohoTab(query);
  const apiQuery = new URLSearchParams(zohoQueueApiQuery(query)).toString();
  const suffix = apiQuery ? `?${apiQuery}` : "";

  if (tab === "check") {
    const result = await fetchAdminJson<AdminRegisterLastCheck>("artwork-register/last-check");
    if (result.status === "unauthorized") redirect("/login");
    if (result.status !== "ok") return <AdminFailedPage title={TITLE} status={result.status} />;
    return <LastCheckView query={query} counts={result.data.counts} check={result.data} />;
  }

  if (tab === "decisions") {
    const result = await fetchAdminJson<AdminRegisterConflictList>(
      `artwork-register/conflicts${suffix}`,
    );
    if (result.status === "unauthorized") redirect("/login");
    if (result.status !== "ok") return <AdminFailedPage title={TITLE} status={result.status} />;
    return <NeedsDecisionList query={query} page={result.data} />;
  }

  const result = await fetchAdminJson<AdminRegisterNewList>(`artwork-register/new${suffix}`);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title={TITLE} status={result.status} />;
  return (
    <NewFromZohoList
      query={query}
      page={result.data}
      bidAdminUrl={await loadBidAdminUrl()}
      zohoUrlTemplate={getShopAdminContainer().config.crmRecordUrlTemplate ?? null}
    />
  );
}
