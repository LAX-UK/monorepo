import type { AdminZohoSyncHealth, ZohoDriftList, ZohoTokenStatus } from "@auction/shop-contracts";
import { SYNC_MODE_LABEL, type ZohoQueueQuery, zohoQueueHref } from "./zoho-register.vm";

export type HealthFigure = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  /** Attention for something slipping, critical only for something failing; absent when fine. */
  tone?: "attention" | "critical";
};

const HOUR_MS = 3_600_000;
/** The nightly passes are overdue after a day and a half, which also covers a late night. */
export const NIGHTLY_STALE_AFTER_HOURS = 36;
/** Writes normally leave the queue within minutes; one waiting longer than this is a backlog. */
export const QUEUE_BACKLOG_AFTER_HOURS = 1;

function olderThanHours(iso: string, now: string, hours: number): boolean {
  return Date.parse(now) - Date.parse(iso) > hours * HOUR_MS;
}

/** Where Failed jobs lives in LAX Bid admin. */
export const FAILED_JOBS_PATH = "/admin/failed-jobs";

/** The link to Failed jobs; null when Bid cannot say where its admin is, or the person cannot open it. */
export function failedJobsHref(bidAdminUrl: string | null): string | null {
  return bidAdminUrl ? `${bidAdminUrl.replace(/\/+$/, "")}${FAILED_JOBS_PATH}` : null;
}

/** The numbers shown for a pass that has not run: a dash, never a zero that reads as "all fine". */
const NONE = "—";

type Format = (iso: string) => string;

export function inboundFigures(
  run: AdminZohoSyncHealth["inbound"]["run"],
  format: Format,
  now: string,
): HealthFigure[] {
  if (!run) {
    return [
      { id: "at", label: "Last run", value: NONE },
      { id: "seen", label: "Products seen", value: NONE },
      { id: "changed", label: "Changed", value: NONE },
      { id: "leftOut", label: "Left out", value: NONE },
    ];
  }
  const dry = run.mode === "dry_run";
  const stale = olderThanHours(run.finishedAt, now, NIGHTLY_STALE_AFTER_HOURS);
  return [
    {
      id: "at",
      label: "Last run",
      value: format(run.finishedAt),
      hint: stale ? "Overdue, it runs every night" : SYNC_MODE_LABEL[run.mode],
      ...(stale ? { tone: "attention" as const } : {}),
    },
    { id: "seen", label: "Products seen", value: String(run.seen) },
    { id: "changed", label: dry ? "Would change" : "Changed", value: String(run.changed) },
    {
      id: "leftOut",
      label: "Left out",
      value: String(run.leftOut),
      hint: run.conflicts > 0 ? `${run.conflicts} need a decision` : "Test artists not counted",
    },
  ];
}

export function listingFigures(
  run: AdminZohoSyncHealth["listing"]["run"],
  format: Format,
  now: string,
): HealthFigure[] {
  if (!run) {
    return [
      { id: "at", label: "Last check", value: NONE },
      { id: "checked", label: "Artworks checked", value: NONE },
      { id: "drift", label: "Drift found", value: NONE },
      { id: "failed", label: "Not written", value: NONE },
    ];
  }
  const stale = olderThanHours(run.finishedAt, now, NIGHTLY_STALE_AFTER_HOURS);
  return [
    {
      id: "at",
      label: "Last check",
      value: format(run.finishedAt),
      hint: stale ? "Overdue, it runs every night" : SYNC_MODE_LABEL[run.mode],
      ...(stale ? { tone: "attention" as const } : {}),
    },
    { id: "checked", label: "Artworks checked", value: String(run.checked) },
    {
      id: "drift",
      label: run.mode === "dry_run" ? "Drift it would correct" : "Drift corrected",
      value: String(run.drift),
    },
    {
      id: "failed",
      label: "Not written",
      value: String(run.failed),
      ...(run.failed > 0 ? { tone: "attention" as const } : {}),
    },
  ];
}

export function outboundFigures(
  outbound: AdminZohoSyncHealth["outbound"],
  format: Format,
  failedJobs: string | null,
  now: string,
): HealthFigure[] {
  const backlog =
    outbound.oldestPendingAt !== null &&
    olderThanHours(outbound.oldestPendingAt, now, QUEUE_BACKLOG_AFTER_HOURS);
  const tone = backlog ? { tone: "attention" as const } : {};
  return [
    { id: "depth", label: "Waiting to go to Zoho", value: String(outbound.depth), ...tone },
    {
      id: "oldest",
      label: "Oldest waiting",
      value: outbound.oldestPendingAt ? format(outbound.oldestPendingAt) : NONE,
      ...(outbound.oldestPendingAt
        ? backlog
          ? { hint: "Waiting longer than usual" }
          : {}
        : { hint: "Nothing is waiting" }),
      ...tone,
    },
    {
      id: "failed",
      label: "Failed for good",
      value: String(outbound.deadLettered),
      hint:
        outbound.deadLettered > 0
          ? failedJobs
            ? "Open Failed jobs to retry or discard"
            : "Waiting in Failed jobs in LAX Bid admin"
          : "Nothing has given up",
      ...(outbound.deadLettered > 0 ? { tone: "attention" as const } : {}),
      ...(outbound.deadLettered > 0 && failedJobs ? { href: failedJobs } : {}),
    },
  ];
}

export function tokenFigures(token: AdminZohoSyncHealth["token"], format: Format): HealthFigure[] {
  return [
    {
      id: "refreshed",
      label: "Last good refresh",
      value: token.refreshedAt ? format(token.refreshedAt) : NONE,
    },
    {
      id: "expires",
      label: "Current token runs out",
      value: token.expiresAt ? format(token.expiresAt) : NONE,
      hint: "LAX gets a new one before then",
    },
    {
      id: "failures",
      label: "Refreshes failed in a row",
      value: String(token.failureStreak),
      ...(token.failureStreak > 0
        ? { tone: token.status === "failing" ? ("critical" as const) : ("attention" as const) }
        : {}),
      ...(token.lastFailureAt ? { hint: `Last failed ${format(token.lastFailureAt)}` } : {}),
    },
  ];
}

export type TokenNotice = {
  tone: "warning" | "danger";
  title: string;
  description: string;
};

const TOKEN_NOTICE: Record<ZohoTokenStatus, TokenNotice | null> = {
  ok: null,
  unknown: null,
  warning: {
    tone: "warning",
    title: "Zoho's access token needs attention",
    description:
      "LAX could not refresh its access to Zoho, or has not refreshed it for a day. It tries again by itself; if this stays, ask whoever manages the Zoho connection to check it.",
  },
  failing: {
    tone: "danger",
    title: "LAX cannot get into Zoho",
    description:
      "Refreshing LAX's access to Zoho has failed twice in a row, so nothing syncs with Zoho until it is fixed. Ask whoever manages the Zoho connection to renew the authorisation.",
  },
};

export function tokenNotice(status: ZohoTokenStatus): TokenNotice | null {
  return TOKEN_NOTICE[status];
}

export const SYNC_OFF_COPY = {
  title: "Zoho sync is off",
  description:
    "LAX is not reading from or writing to Zoho Products on this environment, so there is nothing to report. Turn the sync on in the worker's settings to see its health here.",
};

type DriftListSpec = {
  id: ZohoDriftList;
  /** The section's name, which is also the list's title. */
  title: string;
  /** What staff should do about a row. */
  description: string;
  empty: { title: string; description: string };
  count: (counts: AdminZohoSyncHealth["drift"]) => number;
  /** The API path under artwork-register. */
  apiPath: string;
};

export const DRIFT_LISTS: Record<ZohoDriftList, DriftListSpec> = {
  register_without_product: {
    id: "register_without_product",
    title: "In LAX, deleted in Zoho",
    description:
      "Artworks LAX still holds whose Zoho Product has been deleted. Nothing is withdrawn for them; decide each one in Zoho or on its record.",
    empty: {
      title: "No artwork has lost its Zoho Product",
      description: "Every artwork in LAX still has its Product in Zoho.",
    },
    count: (counts) => counts.registerWithoutProduct,
    apiPath: "artwork-register/sync-health/register-without-product",
  },
  product_without_register: {
    id: "product_without_register",
    title: "In Zoho, not in LAX",
    description:
      "Zoho Products (originals) the nightly check could not bring into LAX. Fix the Product in Zoho and the next check adds it.",
    empty: {
      title: "Every Zoho Product is in LAX",
      description: "The nightly check has brought in every original it found.",
    },
    count: (counts) => counts.productsWithoutRegister,
    apiPath: "artwork-register/sync-health/product-without-register",
  },
  status_mismatch: {
    id: "status_mismatch",
    title: "Place and Zoho Status disagree",
    description:
      "Artworks whose Zoho Status is not the one their place in LAX calls for. LAX writes the Status itself, so a row here usually clears within minutes; one that stays has a failed write.",
    empty: {
      title: "Every Status matches",
      description: "Zoho shows the right Status for every artwork's place in LAX.",
    },
    count: (counts) => counts.statusMismatch,
    apiPath: "artwork-register/sync-health/status-mismatch",
  },
};

export const DRIFT_LIST_ORDER: readonly ZohoDriftList[] = [
  "register_without_product",
  "product_without_register",
  "status_mismatch",
];

export function driftFigures(drift: AdminZohoSyncHealth["drift"]): HealthFigure[] {
  return DRIFT_LIST_ORDER.map((id) => {
    const spec = DRIFT_LISTS[id];
    const count = spec.count(drift);
    return {
      id,
      label: spec.title,
      value: String(count),
      ...(count > 0 ? { href: syncHealthHref({}, { drift: id }) } : { hint: "None" }),
    };
  });
}

/** The Sync health tab's URL, with `change` applied. */
export function syncHealthHref(
  query: ZohoQueueQuery,
  change: { drift?: ZohoDriftList | null; page?: string | null } = {},
): string {
  return zohoQueueHref({ ...query, tab: "health" }, { drift: null, ...change });
}

/** The words for a Zoho Status that is not set. */
export const NO_ZOHO_STATUS = "Not set";

/** Why a Product was left out, for the list of Zoho Products LAX has no record of. */
export function leftOutReason(reason: string | null, label: (reason: string) => string): string {
  return reason === null ? "Would be added by a live run" : label(reason);
}
