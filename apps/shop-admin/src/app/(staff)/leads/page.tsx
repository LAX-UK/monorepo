import { AdminFailedPage } from "@/components/admin-fetch-state";
import { LeadList } from "@/components/leads/lead-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { loadReleaseAlertSummary } from "@/server/application/load-release-alert-summary";
import { leadListApiQuery, parseLeadListQuery } from "@/server/domain/lead-list.vm";
import type { AdminLeadListResponse } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseLeadListQuery(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminLeadListResponse>(
      adminListPath("leads", { cursor: query.cursor, query: leadListApiQuery(query) }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title="Leads" status={result.status} />;
  const releaseAlerts = await loadReleaseAlertSummary(
    session.status === "ok" ? session.data.capabilities : [],
  );
  return (
    <LeadList
      query={query}
      page={result.data}
      now={new Date().toISOString()}
      releaseAlerts={releaseAlerts}
    />
  );
}
