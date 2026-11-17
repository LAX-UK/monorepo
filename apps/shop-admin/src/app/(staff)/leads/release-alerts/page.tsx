import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ReleaseAlertSendLog } from "@/components/leads/release-alert-send-log.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { loadReleaseAlertSummary } from "@/server/application/load-release-alert-summary";
import { ARTWORKS_CAPABILITIES, hasCapability } from "@/server/domain/admin-nav.vm";
import { RELEASE_ALERT_SENDS_COPY } from "@/server/domain/release-alert-sends.copy";
import { parseReleaseAlertSendsQuery } from "@/server/domain/release-alert-sends.vm";
import type { AdminReleaseAlertSendList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: RELEASE_ALERT_SENDS_COPY.documentTitle };

const EMPTY: AdminReleaseAlertSendList = { items: [], nextCursor: null };

/**
 * Leads › Release alerts: what each published edition's release alert sent (design LA-3). The read
 * needs `lead.read`; a role without it gets the page's "cannot open" state, and never the tab.
 */
export default async function ReleaseAlertSendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseReleaseAlertSendsQuery(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminReleaseAlertSendList>(
      adminListPath("release-alerts/sends", { cursor: state.cursor }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return (
      <AdminFailedPage title={RELEASE_ALERT_SENDS_COPY.documentTitle} status={result.status} />
    );
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];
  return (
    <ReleaseAlertSendLog
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      summary={await loadReleaseAlertSummary(capabilities)}
      capabilities={capabilities}
      canOpenArtwork={hasCapability(capabilities, ARTWORKS_CAPABILITIES)}
    />
  );
}
