import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  adminIssueAgeUrgency,
  formatAdminRelativeTimeLabel,
} from "@/lib/admin/format-admin-relative-time";
import { buildPeopleDetailHref } from "@/lib/admin/people/people-detail-href";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type {
  AdminOnboardingIssueRow,
  AdminOnboardingIssuesLensSummary,
} from "@/lib/data/http/admin-onboarding-issues.shared";
import {
  ONBOARDING_TAB_IDS,
  type OnboardingQueueSummary,
  type OnboardingTabId,
  onboardingTabCount,
} from "@/lib/data/view-models/admin-onboarding-issues.vm";
import type { Metric, DataView as StaffDataView, StatusPresentation } from "@auction/staff-ui";

export const ONBOARDING_STAFF_LIST_PATH = "/admin/onboarding-issues";

export type OnboardingListSearch = Record<string, string | string[] | undefined>;

/** The queues, as the tabs name them. */
export const ONBOARDING_TAB_LABELS: Record<OnboardingTabId, string> = {
  entities: "Entities",
  artists: "Artists",
  kyc: "KYC sessions",
  orgs: "Lead organisations",
  documents: "Documents",
};

/** What one row of a queue is, singular, for the record panel. */
const ONBOARDING_KIND_LABELS: Record<OnboardingTabId, string> = {
  entities: "Legal entity",
  artists: "Artist",
  kyc: "KYC session",
  orgs: "Lead organisation",
  documents: "Document",
};

/** One item waiting on staff, whatever the queue; plain data, so it crosses to the client. */
export type OnboardingStaffRow = {
  id: string;
  tab: OnboardingTabId;
  kind: string;
  /** The entity, artist, client or organisation the item is about. */
  title: string;
  /** Under the title: the KYC provider, or what the document is. */
  secondary: string | null;
  status: StatusPresentation | null;
  /** When it started waiting: created, or uploaded for a document. */
  since: string;
  /** "3d ago"; null when the date is missing. */
  ageLabel: string | null;
  urgency: "none" | "attention" | "stale";
  /** The record page that settles it, carrying the way back to this list. */
  href: string;
  /** "Open legal entity", "Review artist": what the record page is for. */
  hrefLabel: string;
};

export function onboardingKycLabel(row: {
  userName?: string | null;
  userEmail?: string | null;
}): string {
  if (row.userName && row.userEmail) return `${row.userName} · ${row.userEmail}`;
  return row.userName || row.userEmail || "Client";
}

/**
 * One queue item as a row. The API's rows differ by queue, so the queue decides which shape to
 * read; a row that does not fit its queue is left out.
 */
export function toOnboardingStaffRow(
  tab: OnboardingTabId,
  row: AdminOnboardingIssueRow,
  returnTarget?: string,
  now: Date = new Date(),
): OnboardingStaffRow | null {
  const base = (
    fields: Pick<OnboardingStaffRow, "title" | "since" | "href" | "hrefLabel"> &
      Partial<Pick<OnboardingStaffRow, "secondary" | "status">>,
  ): OnboardingStaffRow => ({
    id: row.id,
    tab,
    kind: ONBOARDING_KIND_LABELS[tab],
    secondary: null,
    status: null,
    ageLabel: formatAdminRelativeTimeLabel(fields.since, now),
    urgency: adminIssueAgeUrgency(fields.since, now),
    ...fields,
    href: buildPeopleDetailHref(fields.href, returnTarget),
  });

  switch (tab) {
    case "entities":
      return "displayName" in row && "status" in row
        ? base({
            title: row.displayName,
            status: staffStatus("legalEntity", row.status),
            since: row.createdAt,
            href: `/admin/legal-entities/${row.id}`,
            hrefLabel: "Open legal entity",
          })
        : null;
    case "artists":
      return "displayName" in row && !("userId" in row)
        ? base({
            title: row.displayName,
            since: row.createdAt,
            href: `/admin/artists/${row.id}/edit`,
            hrefLabel: "Review artist",
          })
        : null;
    case "kyc":
      return "userId" in row && "provider" in row
        ? base({
            title: onboardingKycLabel(row),
            secondary: row.provider,
            status: staffStatus("kyc", row.status),
            since: row.createdAt,
            href: `/admin/clients/${encodeURIComponent(row.userId)}`,
            hrefLabel: "Open client",
          })
        : null;
    case "orgs":
      return "displayName" in row && "createdAt" in row && !("userId" in row)
        ? base({
            title: row.displayName,
            since: row.createdAt,
            href: `/admin/legal-entities/${row.id}`,
            hrefLabel: "Open entity",
          })
        : null;
    case "documents":
      return "legalEntityId" in row
        ? base({
            title: row.entityDisplayName,
            secondary: "Document awaiting review",
            since: row.uploadedAt,
            href: `/admin/legal-entities/${row.legalEntityId}?tab=documents`,
            hrefLabel: "Review documents",
          })
        : null;
    default: {
      const exhaustive: never = tab;
      return exhaustive;
    }
  }
}

export function toOnboardingStaffRows(
  tab: OnboardingTabId,
  rows: readonly AdminOnboardingIssueRow[],
  returnTarget?: string,
  now: Date = new Date(),
): OnboardingStaffRow[] {
  return rows
    .map((row) => toOnboardingStaffRow(tab, row, returnTarget, now))
    .filter((row): row is OnboardingStaffRow => row !== null);
}

/** A link to the list with some of its URL state changed; paging restarts. */
export function onboardingListHref(
  search: OnboardingListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: OnboardingListSearch = { ...search };
  for (const key of ["error", "success"]) delete base[key];
  return buildListHref(ONBOARDING_STAFF_LIST_PATH, base, {
    ...("offset" in patch ? {} : { offset: null }),
    ...("item" in patch ? {} : { item: null }),
    ...patch,
  });
}

/** The queues as tabs, each with the number of items waiting in it. */
export function onboardingViews(
  search: OnboardingListSearch,
  summary: OnboardingQueueSummary,
): StaffDataView[] {
  return ONBOARDING_TAB_IDS.map((tab) => {
    const count = onboardingTabCount(summary, tab);
    return {
      id: tab,
      label: ONBOARDING_TAB_LABELS[tab],
      href: onboardingListHref(search, { tab }),
      ...(count > 0 ? { count } : {}),
    };
  });
}

/** The numbers over the open queue; up to four. */
export function onboardingMetrics(
  lens: AdminOnboardingIssuesLensSummary | null | undefined,
): Metric[] {
  const count = new Intl.NumberFormat("en-GB");
  const metric = (id: string, label: string, value: number): Metric => ({
    id,
    label,
    value: count.format(value),
  });
  if (!lens) return [];
  switch (lens.tab) {
    case "entities":
      return [
        metric("total", "Entities waiting", lens.summary.total),
        metric("received", "Documents received", lens.summary.docsReceived),
        metric("review", "Under review", lens.summary.underReview),
      ];
    case "artists":
      return [metric("total", "Artists waiting", lens.summary.total)];
    case "kyc":
      return [
        metric("total", "Sessions waiting", lens.summary.total),
        metric("created", "Not started", lens.summary.created),
        metric("input", "Needs input", lens.summary.requiresInput),
        metric("processing", "Processing", lens.summary.processing),
      ];
    case "organizations":
      return [metric("total", "Lead organisations waiting", lens.summary.total)];
    case "documents":
      return [metric("total", "Documents waiting", lens.summary.total)];
    default: {
      const exhaustive: never = lens;
      return exhaustive;
    }
  }
}

/** The queue's items, mid-sentence. */
const ONBOARDING_ITEM_NOUNS: Record<OnboardingTabId, string> = {
  entities: "entities",
  artists: "artists",
  kyc: "KYC sessions",
  orgs: "lead organisations",
  documents: "documents",
};

/** What an empty queue says. */
export function onboardingEmptyCopy(
  tab: OnboardingTabId,
  queueTotal: number,
): { title: string; description: string } {
  if (queueTotal === 0) {
    return {
      title: "All onboarding issues resolved",
      description:
        "No entities, artists, KYC sessions, lead organisations or documents need attention right now.",
    };
  }
  return {
    title: `No ${ONBOARDING_ITEM_NOUNS[tab]} waiting`,
    description: "Nothing is waiting in this queue. Other queues still have items.",
  };
}

/** "1–50 of 312 items". */
export function onboardingRangeSummary(offset: number, shown: number, total: number): string {
  const count = new Intl.NumberFormat("en-GB");
  const noun = total === 1 ? "item" : "items";
  return `${count.format(offset + 1)}–${count.format(offset + shown)} of ${count.format(total)} ${noun}`;
}
