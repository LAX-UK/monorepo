import {
  type AdminZohoMirrorStatus,
  ZOHO_MIRROR_BADGE_LABEL,
  ZOHO_MIRROR_COPY_RECORD_ID,
  ZOHO_MIRROR_DETAILS,
  ZOHO_MIRROR_RECORD_LABEL,
  ZOHO_MIRROR_SEPARATOR,
  zohoMirrorBadgeName,
} from "@auction/shop-contracts";
import {
  type StatusPresentation,
  formatStaffDate,
  formatStaffDateTime,
  formatStaffTime,
} from "@auction/staff-ui";

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

/** Everything the "Mirrored to Zoho" badge and its details show, worked out on the server. */
export type ZohoMirrorBadgeView = {
  state: BadgeState;
  /** The badge text: "Mirrored to Zoho". */
  label: string;
  tone: StatusPresentation["tone"];
  shape: NonNullable<StatusPresentation["shape"]>;
  /** The badge button's accessible name: "Zoho: Mirrored to Zoho, details". */
  name: string;
  /** Z3's sentence after the state, for example "Last sent Sat 14 Nov, 16:02 GMT." */
  sentence: string;
  /** The Zoho record ID to copy; only for Mirrored with a reference. */
  copy: { value: string; label: string } | null;
  /** "Open in Failed jobs", only for Failed and only for people who can open Failed jobs. */
  failedJobsHref: string | null;
};

/** The label CopyButton is given so its name reads "Copy Zoho record ID" (Z3). */
export const ZOHO_RECORD_ID_LABEL = ZOHO_MIRROR_COPY_RECORD_ID.replace(/^Copy /, "");

/** A retry later today reads as a time ("16:10 GMT"); on another day with its date. */
function retryWhen(iso: string, now: Date): string {
  return formatStaffDate(iso, now) === formatStaffDate(now, now)
    ? formatStaffTime(iso, { zoneLabel: true })
    : formatStaffDateTime(iso, now);
}

function detailsLine(status: AdminZohoMirrorStatus, state: BadgeState, now: Date): string {
  switch (state) {
    case "mirrored":
      return ZOHO_MIRROR_DETAILS.mirrored({
        lastSent: status.lastAttemptAt ? formatStaffDateTime(status.lastAttemptAt, now) : "—",
        recordLabel: ZOHO_MIRROR_RECORD_LABEL[status.entity],
        record: status.providerReference,
      });
    case "pending":
      return ZOHO_MIRROR_DETAILS.pending({
        retryAt: status.nextRetryAt ? retryWhen(status.nextRetryAt, now) : null,
        // The try that is waiting: the tries so far, plus this one.
        attempt: status.attempts + 1,
      });
    case "failed":
      return ZOHO_MIRROR_DETAILS.failed({ error: status.error });
    case "dry_run":
      return ZOHO_MIRROR_DETAILS.dry_run();
  }
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
  const line = detailsLine(status, state, now);
  const prefix = `${label}${ZOHO_MIRROR_SEPARATOR}`;
  const { tone, shape = "ring" } = PRESENTATION[state];
  return {
    state,
    label,
    tone,
    shape,
    name: zohoMirrorBadgeName(label),
    sentence: line.startsWith(prefix) ? line.slice(prefix.length) : line,
    copy:
      state === "mirrored" && status.providerReference
        ? { value: status.providerReference, label: ZOHO_RECORD_ID_LABEL }
        : null,
    failedJobsHref: state === "failed" ? failedJobsHref : null,
  };
}
