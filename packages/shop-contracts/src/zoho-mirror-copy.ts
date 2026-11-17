import type {
  ZohoMirrorEntity,
  ZohoMirrorNotApplicableReason,
  ZohoMirrorState,
} from "./admin-zoho-mirror.js";

/**
 * The words of the "Mirrored to Zoho" badge and its details, as approved in
 * `docs/design/staff-gaps-delivery-zoho-alerts.md` Z3, so the order page and the artwork record
 * (PRs 2 and 3) write no copy of their own. Z3 joins a state and its sentence with " · ".
 */
export const ZOHO_MIRROR_SEPARATOR = " · ";

/** The badge text for each state; `not_applicable` has no badge. */
export const ZOHO_MIRROR_BADGE_LABEL: Record<Exclude<ZohoMirrorState, "not_applicable">, string> = {
  mirrored: "Mirrored to Zoho",
  pending: "Sending to Zoho",
  failed: "Not in Zoho",
  dry_run: "Zoho dry run",
};

/** The heading of the details for a record that is not mirrored. */
export const ZOHO_MIRROR_NOT_MIRRORED = "Not mirrored";

/**
 * The details line for a record that is not mirrored. The first three are Z3's words;
 * `nothing_to_mirror` and `not_sent_yet` are not in Z3 and are put to the owner in PR #1516.
 */
export const ZOHO_MIRROR_NOT_APPLICABLE_COPY: Record<ZohoMirrorNotApplicableReason, string> = {
  mirroring_off: "Not mirrored · Zoho mirroring is off.",
  not_paid: "Not mirrored · Only paid orders are sent to Zoho.",
  not_in_register: "Not mirrored · This original is not in the artwork register.",
  nothing_to_mirror: "Not mirrored · There is nothing to send to Zoho for this.",
  not_sent_yet: "Not mirrored · Nothing has been sent to Zoho for this yet.",
};

/** What the Zoho record a successful send reached is called, before its reference. */
export const ZOHO_MIRROR_RECORD_LABEL: Record<ZohoMirrorEntity, string> = {
  order: "Dispatch record",
  artwork: "Zoho record",
};

/** The action beside a Mirrored record's reference. */
export const ZOHO_MIRROR_COPY_RECORD_ID = "Copy Zoho record ID";

/** The link from a Failed record, shown only to staff who can open Failed jobs. */
export const ZOHO_MIRROR_OPEN_FAILED_JOBS = "Open in Failed jobs";

/** The badge button's accessible name, for example "Zoho: Mirrored to Zoho, details". */
export function zohoMirrorBadgeName(label: string): string {
  return `Zoho: ${label}, details`;
}

/**
 * The details for each state with a badge. Dates and times come in already formatted, in London
 * time and the LAX date style of `@auction/datetime` with no zone name, as Z3 writes them:
 * `formatDateTime` for a moment ("14 Nov 2026, 16:02") and `formatTime` for a time later the same
 * day ("16:10"). The record is the Zoho reference, when any.
 */
export const ZOHO_MIRROR_DETAILS = {
  mirrored: (input: { lastSent: string; recordLabel: string; record: string | null }) =>
    `Mirrored to Zoho · Last sent ${input.lastSent}.${
      input.record ? ` ${input.recordLabel} ${input.record}.` : ""
    }`,
  pending: (input: { retryAt: string | null; attempt: number }) =>
    `Sending to Zoho · Waiting to send the latest change.${
      input.retryAt ? ` Tries again at ${input.retryAt} (attempt ${input.attempt}).` : ""
    }`,
  failed: (input: { error: string | null }) =>
    `Not in Zoho · Zoho refused the last change${
      input.error ? `: ${input.error}` : ""
    }. Staff in Failed jobs can fix and replay it.`,
  dry_run: () => "Zoho dry run · LAX worked out what it would send and wrote nothing to Zoho.",
} as const;
