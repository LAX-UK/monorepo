import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AllFromZohoList } from "@/components/from-zoho/all-from-zoho-list.client";
import { NeedsDecisionList, NewFromZohoList } from "@/components/from-zoho/from-zoho-list.client";
import { LastCheckView } from "@/components/from-zoho/last-check-view.client";
import { LinkLaxArtReport } from "@/components/from-zoho/link-lax-art-report.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { loadBidAdminUrl } from "@/server/application/load-bid-admin-url";
import { getShopAdminContainer } from "@/server/container";
import {
  activeZohoTab,
  parseZohoQueueQuery,
  zohoQueueApiQuery,
} from "@/server/domain/zoho-register.vm";
import type {
  AdminRegisterAllList,
  AdminRegisterConflictList,
  AdminRegisterLastCheck,
  AdminRegisterNewList,
  AdminSoldAttentionList,
  AdminZohoLinkCount,
  AdminZohoLinkReport,
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

  // How many lax.art originals are not linked to Zoho yet: the Link lax.art tab shows while any are.
  // A failed count leaves the tab out rather than failing the page.
  const unlinkedResult = await fetchAdminJson<AdminZohoLinkCount>(
    "artwork-register/zoho-link/count",
  );
  if (unlinkedResult.status === "unauthorized") redirect("/login");
  const unlinked = unlinkedResult.status === "ok" ? unlinkedResult.data.unlinked : 0;

  if (tab === "link") {
    const [report, check] = await Promise.all([
      fetchAdminJson<AdminZohoLinkReport>("artwork-register/zoho-link/report"),
      fetchAdminJson<AdminRegisterLastCheck>("artwork-register/last-check"),
    ]);
    if (report.status === "unauthorized" || check.status === "unauthorized") redirect("/login");
    if (report.status !== "ok") return <AdminFailedPage title={TITLE} status={report.status} />;
    if (check.status !== "ok") return <AdminFailedPage title={TITLE} status={check.status} />;
    return <LinkLaxArtReport query={query} counts={check.data.counts} report={report.data} />;
  }

  if (tab === "check") {
    const result = await fetchAdminJson<AdminRegisterLastCheck>("artwork-register/last-check");
    if (result.status === "unauthorized") redirect("/login");
    if (result.status !== "ok") return <AdminFailedPage title={TITLE} status={result.status} />;
    return (
      <LastCheckView
        query={query}
        counts={result.data.counts}
        check={result.data}
        unlinked={unlinked}
      />
    );
  }

  if (tab === "decisions") {
    const [result, attention] = await Promise.all([
      fetchAdminJson<AdminRegisterConflictList>(`artwork-register/conflicts${suffix}`),
      fetchAdminJson<AdminSoldAttentionList>("artwork-register/attention"),
    ]);
    if (result.status === "unauthorized" || attention.status === "unauthorized") {
      redirect("/login");
    }
    if (result.status !== "ok") return <AdminFailedPage title={TITLE} status={result.status} />;
    if (attention.status !== "ok") {
      return <AdminFailedPage title={TITLE} status={attention.status} />;
    }
    return (
      <NeedsDecisionList
        query={query}
        page={result.data}
        attention={attention.data}
        bidAdminUrl={await loadBidAdminUrl()}
        unlinked={unlinked}
        zohoUrlTemplate={getShopAdminContainer().config.crmRecordUrlTemplate ?? null}
      />
    );
  }

  if (tab === "all") {
    const result = await fetchAdminJson<AdminRegisterAllList>(`artwork-register/all${suffix}`);
    if (result.status === "unauthorized") redirect("/login");
    if (result.status !== "ok") return <AdminFailedPage title={TITLE} status={result.status} />;
    return (
      <AllFromZohoList
        query={query}
        page={result.data}
        unlinked={unlinked}
        bidAdminUrl={await loadBidAdminUrl()}
        zohoUrlTemplate={getShopAdminContainer().config.crmRecordUrlTemplate ?? null}
      />
    );
  }

  const result = await fetchAdminJson<AdminRegisterNewList>(`artwork-register/new${suffix}`);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title={TITLE} status={result.status} />;
  return (
    <NewFromZohoList
      query={query}
      page={result.data}
      unlinked={unlinked}
      bidAdminUrl={await loadBidAdminUrl()}
      zohoUrlTemplate={getShopAdminContainer().config.crmRecordUrlTemplate ?? null}
    />
  );
}
