import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AuditLogList } from "@/components/audit/audit-log-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { auditList } from "@/server/domain/people-lists.vm";
import type { AdminAuditFacets, AdminAuditList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Audit log" };

const EMPTY: AdminAuditList = { items: [], nextCursor: null };
const NO_FACETS: AdminAuditFacets = { actions: [], targetTypes: [], actors: [] };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = auditList.parse(await searchParams);
  const [result, facets] = await Promise.all([
    fetchAdminJson<AdminAuditList>(
      adminListPath("audit", { cursor: state.cursor, query: auditList.apiQuery(state) }),
    ),
    fetchAdminJson<AdminAuditFacets>("audit/facets"),
  ]);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Audit log" status={result.status} />;
  }

  return (
    <AuditLogList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      // The filters still work by URL when their options did not load.
      facets={facets.status === "ok" ? facets.data : NO_FACETS}
      loadFailed={result.status === "failed"}
    />
  );
}
