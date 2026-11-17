import { LONDON_TIME_ZONE, dayKey, formatDateTime, formatTime } from "@auction/datetime";
import {
  type AdminZohoMirrorStatus,
  ZOHO_MIRROR_BADGE_LABEL,
  ZOHO_MIRROR_COPY_RECORD_ID,
  ZOHO_MIRROR_DETAILS,
  ZOHO_MIRROR_RECORD_LABEL,
  ZOHO_MIRROR_SEPARATOR,
  zohoMirrorBadgeName,
} from "@auction/shop-contracts";
import type { StatusPresentation } from "@auction/staff-ui";
import { failedJobsHref as bidFailedJobsHref } from "./zoho-sync-health.vm";

type BadgeState = Exclude<AdminZohoMirrorStatus["state"], "not_applicable">;

/**
 * Tone and cue per state (Z2): Success ✓, Info filled dot, Danger !, Neutral ring. The cue is set
 * explicitly so the shape still tells the states apart in grey-scale whatever the tone defaults are.
 */
const PRESENTATION: Record<BadgeState, Omit<StatusPresentation, "label">> = {
  mirrored: { tone: "success", shape: "check" },
  pending: { tone: "info", shape: "dot" },
  failed: { tone: "danger", shape: "alert" },
  dry_run: { tone: "neutral", shape: "ring" },
};

/** A time as the details word it, with the moment it names: "16:10" for 2026-11-14T16:10Z. */
export type ZohoMirrorTime = { text: string; dateTime: string };

/** Everything the "Mirrored to Zoho" badge and its details show, worked out on the server. */
export type ZohoMirrorBadgeView = {
  state: BadgeState;
  /** The badge text: "Mirrored to Zoho". */
  label: string;
  tone: StatusPresentation["tone"];
  shape: NonNullable<StatusPresentation["shape"]>;
  /** The badge button's accessible name: "Zoho: Mirrored to Zoho, details". */
  name: string;
  /** Z3's sentence after the state, for example "Last sent 14 Nov 2026, 16:02." */
  sentence: string;
  /** The times in the sentence, in order, with the moment each one names (for `<time>`). */
  times: ZohoMirrorTime[];
  /** The Zoho record ID to copy; only for Mirrored with a reference. */
  copy: { value: string; label: string } | null;
  /** "Open in Failed jobs", only for Failed and only for people who can open Failed jobs. */
  failedJobsHref: string | null;
};

/** The label CopyButton is given so its name reads "Copy Zoho record ID" (Z3). */
export const ZOHO_RECORD_ID_LABEL = ZOHO_MIRROR_COPY_RECORD_ID.replace(/^Copy /, "");

/**
 * Z3's times, as the shared copy file documents them: the LAX date style from `@auction/datetime`
 * in London time, "14 Nov 2026, 16:02" for when it was last sent.
 */
function sentAt(iso: string): ZohoMirrorTime {
  return { text: formatDateTime(new Date(iso), LONDON_TIME_ZONE), dateTime: iso };
}

/** A retry later today reads as a time ("16:10", Z3); on another London day with its date. */
function retryAt(iso: string, now: Date): ZohoMirrorTime {
  const date = new Date(iso);
  const today = dayKey(date, LONDON_TIME_ZONE) === dayKey(now, LONDON_TIME_ZONE);
  return {
    text: today ? formatTime(date, LONDON_TIME_ZONE) : formatDateTime(date, LONDON_TIME_ZONE),
    dateTime: iso,
  };
}

function details(
  status: AdminZohoMirrorStatus,
  state: BadgeState,
  now: Date,
): { line: string; times: ZohoMirrorTime[] } {
  switch (state) {
    case "mirrored": {
      const sent = status.lastAttemptAt ? sentAt(status.lastAttemptAt) : null;
      return {
        line: ZOHO_MIRROR_DETAILS.mirrored({
          lastSent: sent?.text ?? "—",
          recordLabel: ZOHO_MIRROR_RECORD_LABEL[status.entity],
          record: status.providerReference,
        }),
        times: sent ? [sent] : [],
      };
    }
    case "pending": {
      const retry = status.nextRetryAt ? retryAt(status.nextRetryAt, now) : null;
      return {
        line: ZOHO_MIRROR_DETAILS.pending({
          retryAt: retry?.text ?? null,
          // The try that is waiting: the tries so far, plus this one.
          attempt: status.attempts + 1,
        }),
        times: retry ? [retry] : [],
      };
    }
    case "failed":
      return { line: ZOHO_MIRROR_DETAILS.failed({ error: status.error }), times: [] };
    case "dry_run":
      return { line: ZOHO_MIRROR_DETAILS.dry_run(), times: [] };
  }
}

/** The Failed jobs source that holds the Zoho mirror's dead letters, as Bid names it. */
export const ZOHO_FAILED_JOBS_SOURCE = "integrations.zoho";

/**
 * "Open in Failed jobs" for a record not in Zoho, filtered to integrations, or null when the person
 * cannot open it (Q7, PRM-1): it needs Bid admin and Bid's own access table to show them the Zoho
 * rows. Opening Bid admin alone is not enough; a Bid specialist or finance would be refused.
 */
export function zohoFailedJobsHref({
  bidUrl,
  failedJobSources,
}: {
  /** Where Bid is (its public origin), for a person who can open Bid admin; null otherwise. */
  bidUrl: string | null;
  failedJobSources: readonly string[];
}): string | null {
  if (!failedJobSources.includes(ZOHO_FAILED_JOBS_SOURCE)) return null;
  const href = bidFailedJobsHref(bidUrl);
  return href ? `${href}?source=integrations` : null;
}

/**
 * The badge for one record, or null when it has none: Z2's "Not applicable" shows no badge so it
 * does not become wallpaper. Z3's words come whole from `@auction/shop-contracts`; the details
 * show the state as their heading, so only the part after " · " is kept as the sentence.
 */
export function presentZohoMirror(
  status: AdminZohoMirrorStatus | null,
  {
    now = new Date(),
    failedJobsHref = null,
  }: {
    now?: Date;
    /** Where Failed jobs is, for a person who can open it; null for everyone else. */
    failedJobsHref?: string | null;
  } = {},
): ZohoMirrorBadgeView | null {
  if (!status || status.state === "not_applicable") return null;
  const state = status.state;
  const label = ZOHO_MIRROR_BADGE_LABEL[state];
  const { line, times } = details(status, state, now);
  const prefix = `${label}${ZOHO_MIRROR_SEPARATOR}`;
  const { tone, shape = "ring" } = PRESENTATION[state];
  return {
    state,
    label,
    tone,
    shape,
    name: zohoMirrorBadgeName(label),
    sentence: line.startsWith(prefix) ? line.slice(prefix.length) : line,
    times,
    copy:
      state === "mirrored" && status.providerReference
        ? { value: status.providerReference, label: ZOHO_RECORD_ID_LABEL }
        : null,
    failedJobsHref: state === "failed" ? failedJobsHref : null,
  };
}
