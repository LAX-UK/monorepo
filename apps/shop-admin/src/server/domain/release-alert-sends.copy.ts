import type { AdminReleaseAlertSendStatus } from "@auction/shop-contracts";

/**
 * Every word of the release-alert send log in LAX Admin (docs/design/staff-gaps-delivery-zoho-
 * alerts.md, LA-3: L1, L2 and L5), in one place so the screen, its tests and the browser gate read
 * the same sentences. Sentence case throughout. Counts only: no sentence names a subscriber (Q9).
 */
export const RELEASE_ALERT_SENDS_COPY = {
  /** The view tab beside the leads list (L1). It carries no count: it is history, not a queue. */
  tab: "Release alerts",
  /** The browser tab's title. */
  documentTitle: "Release alerts",
  /** The Leads page's heading, kept on this view so staff know where they are. */
  pageTitle: "Leads",
  description:
    "Each published edition and what its release alert sent. Counts only: nobody on the list is named here.",
  metricsLabel: "Release alerts",
  metricsPeriod: "People who asked to hear about new editions",

  columns: {
    edition: "Edition",
    published: "Published",
    toldSubscribers: "Told subscribers",
    matched: "People matched",
    emailed: "Emailed",
    waiting: "Waiting",
    notSent: "Not sent",
    status: "Status",
    /** The phone's one line of counts, "Emailed 398 of 412" (Accessibility, themes and phone). */
    phoneCounts: "Counts",
  },
  yes: "Yes",
  no: "No",
  noThumbnail: "No picture yet",
  publishedBy: (name: string) => `by ${name}`,
  /** The phone line under the edition: "Emailed 398 of 412". */
  emailedOf: (emailed: string, matched: string) => `Emailed ${emailed} of ${matched}`,

  empty: {
    title: "No release alerts yet",
    description: "When you publish an edition and tick Tell subscribers, it appears here.",
  },
  error: {
    title: "Release alerts could not be loaded",
    description: "Try again in a moment.",
  },
  noResultsNoun: "release alerts",
  pageSummary: { one: "release", other: "releases" },
  firstPage: "First page",

  rowActions: (title: string) => `Actions for ${title}`,
  openRelease: "Open release alert",
  openArtwork: "Open artwork",

  panel: {
    queueNoun: "release",
    /** Shown while the release is loading into the panel, before its title is known. */
    fallbackTitle: "Release alert",
    published: "Published",
    publishedBy: "By",
    counts: "What was sent",
    reasons: "Why some were not sent",
    noPublisher: "Not recorded",
    /** A panel link (`?release=`) that names no release in the log (PRD-7). */
    notFound: {
      title: "Release alert not found",
      description:
        "No published edition in the log matches this link. The work may have been deleted, or the link may be incomplete.",
    },
    /** A panel link whose release could not be read just now. */
    linkFailed: {
      title: "Release alert could not be loaded",
      description: "Try again in a moment.",
    },
  },
} as const;

/** The badge per status (L2): the words, and the cue drawn before them. */
export const RELEASE_ALERT_STATUS_LABEL: Record<AdminReleaseAlertSendStatus, string> = {
  not_announced: "Not announced",
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  not_sent_yet: "Not sent yet",
  counts_not_kept: "Counts not kept",
};

/**
 * The one line the panel opens with for each status, so staff know what the badge means and what,
 * if anything, to do. `null` where the counts say it all.
 */
export const RELEASE_ALERT_STATUS_NOTICE: Record<AdminReleaseAlertSendStatus, string | null> = {
  // L2's own words.
  not_announced: "Publisher chose not to tell subscribers.",
  queued: "The next alert run will work out who to tell. Nobody has been emailed yet.",
  sending: "Each person gets it in their next daily email.",
  sent: null,
  not_sent_yet:
    "Some emails are still unsent more than a day after they were made. The daily alert run should have sent them: check the alert run.",
  // L3's alternative, "Details no longer kept", for releases from before the counts were kept.
  counts_not_kept:
    "Details no longer kept in full. This release is from before the counts were kept, so these figures may be lower than what was sent.",
};

const people = (count: number) => (count === 1 ? "1 person" : `${count} people`);
const was = (count: number) => (count === 1 ? "was" : "were");

/**
 * Why matches were not sent, as plain sentences (L2). The codes are the alert engine's drop
 * reasons and the send log's own `removed_before_sending`; any other code reads as a plain "other
 * reason" rather than leaking the code.
 */
export const RELEASE_ALERT_NOT_SENT_REASON: Record<string, (count: number) => string> = {
  not_subscribed: (n) =>
    `${people(n)} had stopped release alerts or not confirmed by the time it went.`,
  topic_off: (n) => `${people(n)} had turned off emails about new editions.`,
  withdrawn: (n) => `${people(n)} ${was(n)} not emailed because the work came off sale first.`,
  removed_before_sending: (n) => `${people(n)} ${was(n)} removed from the list before it went.`,
};

export const releaseAlertOtherReason = (count: number) =>
  `${people(count)} ${was(count)} not emailed for another reason.`;
