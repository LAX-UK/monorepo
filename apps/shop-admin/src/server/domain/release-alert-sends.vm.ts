import { LONDON_TIME_ZONE, formatDateTime } from "@auction/datetime";
import type { AdminReleaseAlertSend, AdminReleaseAlertSendStatus } from "@auction/shop-contracts";
import { defineStatusMap } from "@auction/staff-ui";
import { type RawSearchParams, listHref, singleParam } from "./list-url-state";
import {
  RELEASE_ALERT_NOT_SENT_REASON,
  RELEASE_ALERT_SENDS_COPY,
  RELEASE_ALERT_STATUS_LABEL,
  releaseAlertOtherReason,
} from "./release-alert-sends.copy";

/*
 * The release-alert send log's rules (docs/design/staff-gaps-delivery-zoho-alerts.md, LA-3), pure
 * so they are tested without rendering: its address, the badge per status, the London times and
 * the sentences the panel says. The read (`GET /admin/v1/release-alerts/sends`) needs `lead.read`.
 */

/** The view tab beside the leads list (L1). */
export const RELEASE_ALERT_SENDS_PATH = "/leads/release-alerts";

/** What reading the log needs: the same capability as the route behind it. */
export const RELEASE_ALERT_SENDS_CAPABILITY = "lead.read";

/** The search param naming the release open in the panel (a record with no page, PRD-7). */
export const RELEASE_ALERT_PANEL_PARAM = "release";

/** The log in the URL: the page (a cursor from the read) and the release open in the panel. */
export type ReleaseAlertSendsState = { cursor?: string; open?: string };

export function parseReleaseAlertSendsQuery(params: RawSearchParams): ReleaseAlertSendsState {
  const cursor = singleParam(params.cursor);
  const open = singleParam(params[RELEASE_ALERT_PANEL_PARAM]);
  return { ...(cursor ? { cursor } : {}), ...(open ? { open } : {}) };
}

/** The log's address on this page, with a release's panel open or closed for null. */
export function releaseAlertPanelHref(state: ReleaseAlertSendsState, id: string | null): string {
  return listHref(RELEASE_ALERT_SENDS_PATH, {
    cursor: state.cursor,
    [RELEASE_ALERT_PANEL_PARAM]: id ?? undefined,
  });
}

/** The log one page on, with no panel open. */
export function releaseAlertPageHref(cursor: string | null): string {
  return listHref(RELEASE_ALERT_SENDS_PATH, { cursor: cursor ?? undefined });
}

/** The badge per status (L2): neutral ring, info dot, success tick, danger alert. */
export const presentReleaseAlertStatus = defineStatusMap<AdminReleaseAlertSendStatus>({
  not_announced: { label: RELEASE_ALERT_STATUS_LABEL.not_announced, tone: "neutral" },
  queued: { label: RELEASE_ALERT_STATUS_LABEL.queued, tone: "info" },
  sending: { label: RELEASE_ALERT_STATUS_LABEL.sending, tone: "info" },
  sent: { label: RELEASE_ALERT_STATUS_LABEL.sent, tone: "success" },
  not_sent_yet: { label: RELEASE_ALERT_STATUS_LABEL.not_sent_yet, tone: "danger" },
  // Finished, so a tick, but neutral: what is left of its matches may be fewer than went out.
  counts_not_kept: {
    label: RELEASE_ALERT_STATUS_LABEL.counts_not_kept,
    tone: "neutral",
    shape: "check",
  },
});

const COUNT = new Intl.NumberFormat("en-GB");

/** A count as the log writes it: "1,204". */
export function formatReleaseAlertCount(count: number): string {
  return COUNT.format(count);
}

/** A moment in the LAX date style, in London time: "14 Nov 2026, 16:02", with its instant. */
export type ReleaseAlertTime = { text: string; dateTime: string };

export function releaseAlertPublishedAt(row: Pick<AdminReleaseAlertSend, "publishedAt">) {
  return {
    text: formatDateTime(new Date(row.publishedAt), LONDON_TIME_ZONE),
    dateTime: row.publishedAt,
  } satisfies ReleaseAlertTime;
}

/** "by Ada Example" under the time; null when no publisher was kept. */
export function releaseAlertPublishedBy(row: Pick<AdminReleaseAlertSend, "publishedByName">) {
  return row.publishedByName ? RELEASE_ALERT_SENDS_COPY.publishedBy(row.publishedByName) : null;
}

/**
 * The phone's line of counts, "Emailed 398 of 412". A release nobody was told about has no counts
 * to give: its badge says so.
 */
export function releaseAlertPhoneCounts(
  row: Pick<AdminReleaseAlertSend, "toldSubscribers" | "emailed" | "matched">,
): string | null {
  if (!row.toldSubscribers) return null;
  return RELEASE_ALERT_SENDS_COPY.emailedOf(
    formatReleaseAlertCount(row.emailed),
    formatReleaseAlertCount(row.matched),
  );
}

/** Why matches were not sent, one plain sentence per reason, most first (as the read orders them). */
export function releaseAlertNotSentSentences(
  row: Pick<AdminReleaseAlertSend, "notSentReasons">,
): string[] {
  return row.notSentReasons
    .filter((entry) => entry.count > 0)
    .map((entry) =>
      (RELEASE_ALERT_NOT_SENT_REASON[entry.reason] ?? releaseAlertOtherReason)(entry.count),
    );
}

/** The counts a release's panel lists, in the order a send moves through. */
export function releaseAlertCountFacts(
  row: Pick<
    AdminReleaseAlertSend,
    "toldSubscribers" | "matched" | "emailed" | "waiting" | "notSent"
  >,
) {
  const { columns, yes, no } = RELEASE_ALERT_SENDS_COPY;
  return [
    { label: columns.toldSubscribers, value: row.toldSubscribers ? yes : no },
    { label: columns.matched, value: formatReleaseAlertCount(row.matched) },
    { label: columns.emailed, value: formatReleaseAlertCount(row.emailed) },
    { label: columns.waiting, value: formatReleaseAlertCount(row.waiting) },
    { label: columns.notSent, value: formatReleaseAlertCount(row.notSent) },
  ];
}
