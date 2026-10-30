import { AdminFailedPage } from "@/components/admin-fetch-state";
import { LeadList } from "@/components/leads/lead-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
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
  const result = await fetchAdminJson<AdminLeadListResponse>(
    adminListPath("leads", { cursor: query.cursor, query: leadListApiQuery(query) }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title="Leads" status={result.status} />;
  return <LeadList query={query} page={result.data} now={new Date().toISOString()} />;
}
