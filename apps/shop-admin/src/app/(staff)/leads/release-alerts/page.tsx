import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ReleaseAlertSendLog } from "@/components/leads/release-alert-send-log.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { loadReleaseAlertSummary } from "@/server/application/load-release-alert-summary";
import { ARTWORKS_CAPABILITIES, hasCapability } from "@/server/domain/admin-nav.vm";
import { RELEASE_ALERT_SENDS_COPY } from "@/server/domain/release-alert-sends.copy";
import {
  type ReleaseAlertLinked,
  parseReleaseAlertSendsQuery,
  releaseAlertSendsCapabilities,
} from "@/server/domain/release-alert-sends.vm";
import type { AdminReleaseAlertSend, AdminReleaseAlertSendList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: RELEASE_ALERT_SENDS_COPY.documentTitle };

const EMPTY: AdminReleaseAlertSendList = { items: [], nextCursor: null };

/**
 * The release a panel link (`?release=`) names when it is not on the page shown, read on its own
 * so the panel still opens (PRD-7): a link shared from the first page keeps working after newer
 * releases push it onto a later page. Null when no release is named, or it is on the page.
 */
async function linkedOffPage(
  open: string | undefined,
  page: AdminReleaseAlertSendList,
): Promise<ReleaseAlertLinked | null> {
  if (!open || page.items.some((row) => row.artworkId === open)) return null;
  const found = await fetchAdminJson<AdminReleaseAlertSend>(
    `release-alerts/sends/${encodeURIComponent(open)}`,
  );
  if (found.status === "ok") return { status: "found", row: found.data };
  // A malformed id is refused by the read (400, "failed" here), and names no release either.
  if (found.status === "not_found" || found.status === "failed") {
    return { status: found.status, id: open };
  }
  return { status: "failed", id: open };
}

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
  // Reaching here means the read did not refuse `lead.read`, so the page keeps its own tab even
  // when the session could not be read; anything else the session grants stays unknown.
  const capabilities = releaseAlertSendsCapabilities(
    session.status === "ok" ? session.data.capabilities : [],
  );
  const page = result.status === "ok" ? result.data : EMPTY;
  return (
    <ReleaseAlertSendLog
      state={state}
      page={page}
      linked={result.status === "ok" ? await linkedOffPage(state.open, page) : null}
      loadFailed={result.status === "failed"}
      summary={await loadReleaseAlertSummary(capabilities)}
      capabilities={capabilities}
      canOpenArtwork={hasCapability(capabilities, ARTWORKS_CAPABILITIES)}
    />
  );
}
