import {
  SUBJECT_EXPORT_MAX_OPEN_REQUESTS,
  SUBJECT_EXPORT_PRODUCTS,
  SUBJECT_EXPORT_RETENTION_DAYS,
  type SubjectExportProduct,
  type SubjectExportProgress,
  type SubjectExportStatus,
  type SubjectExportView,
} from "@auction/identity-contracts";
import type {
  SubjectExportMutation,
  SubjectExportProductState,
  SubjectExportProgressMap,
  SubjectExportRow,
} from "./subject-export.ports.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Statuses in which the worker is still preparing the copy. */
const PREPARING: readonly SubjectExportStatus[] = ["requested", "collecting", "delayed"];

/** The request is overdue by these amounts: ops hears at 24 hours, the data protection contact at 7 days, an on-call page at 21. */
export const SUBJECT_EXPORT_DEADLINE_TIERS = [
  { tier: 1, afterMs: 24 * HOUR_MS, audience: "operations" },
  { tier: 2, afterMs: 7 * DAY_MS, audience: "data_protection_contact" },
  { tier: 3, afterMs: 21 * DAY_MS, audience: "on_call" },
] as const;

/** Who an alert at this tier goes to, recorded on the request's timeline. */
export function deadlineAlertAudience(tier: number): string | null {
  return SUBJECT_EXPORT_DEADLINE_TIERS.find((entry) => entry.tier === tier)?.audience ?? null;
}

export function isPreparing(status: SubjectExportStatus): boolean {
  return PREPARING.includes(status);
}

export function initialProgress(): SubjectExportProgressMap {
  return { account: "waiting", bid: "waiting", shop: "waiting" };
}

/** Highest overdue tier a request still being prepared has reached; 0 when it is on time. */
export function deadlineTierFor(row: SubjectExportRow, now: Date): number {
  if (!isPreparing(row.status)) return 0;
  const age = now.getTime() - row.requestedAt.getTime();
  return SUBJECT_EXPORT_DEADLINE_TIERS.reduce(
    (reached, { tier, afterMs }) => (age >= afterMs ? tier : reached),
    0,
  );
}

export type CreateDecision =
  | { kind: "create" }
  | { kind: "already_open"; row: SubjectExportRow }
  | { kind: "rate_limited"; retryAfter: Date };

/**
 * One open request at a time, and at most `max` requests in the rolling window. A request that
 * failed on our side does not count against the person. `windowRequests` is newest first.
 */
export function decideCreate(input: {
  open: SubjectExportRow[];
  windowRequests: SubjectExportRow[];
  max: number;
  windowDays: number;
}): CreateDecision {
  const [open] = input.open;
  if (open && input.open.length >= SUBJECT_EXPORT_MAX_OPEN_REQUESTS) {
    return { kind: "already_open", row: open };
  }
  const counted = input.windowRequests.filter((row) => row.status !== "failed");
  if (counted.length >= input.max) {
    // The window frees a place when the oldest request that still counts leaves it.
    const oldest = counted[input.max - 1] ?? counted[counted.length - 1];
    const leaves = (oldest?.requestedAt.getTime() ?? 0) + input.windowDays * DAY_MS;
    return { kind: "rate_limited", retryAfter: new Date(leaves) };
  }
  return { kind: "create" };
}

/** The key a worker may report: under the request's own prefix, so one request cannot name another's file. */
export function subjectExportObjectPrefix(exportId: string): string {
  return `subject-exports/${exportId}/`;
}

function summarise(
  categories: { id: string; schemaVersion: number; count: number }[],
): Record<string, string | number> {
  return {
    categories: categories.length,
    records: categories.reduce((total, category) => total + category.count, 0),
    counts: categories.map((c) => `${c.id}:${c.count}`).join(","),
    schemaVersions: categories.map((c) => `${c.id}:${c.schemaVersion}`).join(","),
  };
}

function withProduct(
  progress: SubjectExportProgressMap,
  product: SubjectExportProduct,
  state: SubjectExportProductState,
): SubjectExportProgressMap {
  return { ...progress, [product]: state };
}

/**
 * The state machine for what the worker reports. Reports are applied once: a repeated report
 * (the worker retries) and a report that arrives in a state it no longer applies to both return
 * null, so nothing changes and nothing is audited twice. `failed` and the finished states are
 * terminal.
 */
export function decideProgress(
  row: SubjectExportRow,
  report: SubjectExportProgress,
  now: Date,
): SubjectExportMutation | null {
  if (!isPreparing(row.status)) return null;

  switch (report.event) {
    case "product_collected": {
      if (row.productProgress[report.product] === "done") return null;
      const progress = withProduct(row.productProgress, report.product, "done");
      const retrying = SUBJECT_EXPORT_PRODUCTS.some((product) => progress[product] === "retrying");
      return {
        patch: {
          status: retrying ? "delayed" : "collecting",
          productProgress: progress,
        },
        audit: [
          {
            event: "data_export.product_collected",
            detail: { product: report.product, ...summarise(report.categories) },
          },
        ],
      };
    }
    case "delayed": {
      if (row.status === "delayed" && row.productProgress[report.product] === "retrying") {
        return null;
      }
      if (row.productProgress[report.product] === "done") return null;
      return {
        patch: {
          status: "delayed",
          productProgress: withProduct(row.productProgress, report.product, "retrying"),
          lastErrorCode: report.errorCode,
        },
        audit: [
          {
            event: "data_export.delayed",
            detail: { product: report.product, errorCode: report.errorCode },
          },
        ],
      };
    }
    case "ready": {
      const expiresAt = new Date(now.getTime() + SUBJECT_EXPORT_RETENTION_DAYS * DAY_MS);
      return {
        patch: {
          status: "ready",
          productProgress: { account: "done", bid: "done", shop: "done" },
          readyAt: now,
          expiresAt,
          objectKey: report.objectKey,
          fileName: report.fileName,
          sizeBytes: report.sizeBytes,
          sha256: report.sha256,
          lastErrorCode: null,
        },
        audit: [
          {
            event: "data_export.ready",
            detail: {
              sizeBytes: report.sizeBytes,
              sha256: report.sha256,
              expiresAt: expiresAt.toISOString(),
            },
          },
        ],
      };
    }
    case "failed":
      return {
        patch: { status: "failed", lastErrorCode: report.errorCode },
        audit: [{ event: "data_export.failed", detail: { errorCode: report.errorCode } }],
      };
  }
}

/** What LAX Account reads. A ready copy past its expiry reads as expired even before the schedule has caught up. */
export function toSubjectExportView(row: SubjectExportRow, now: Date): SubjectExportView {
  const lapsed = row.status === "ready" && row.expiresAt !== null && row.expiresAt <= now;
  const status: SubjectExportStatus = lapsed ? "expired" : row.status;
  const downloadable = status === "ready";
  const working = status === "collecting" || status === "delayed";
  return {
    id: row.id,
    status,
    requestedAt: row.requestedAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    readyAt: row.readyAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    fileName: downloadable ? row.fileName : null,
    sizeBytes: downloadable ? row.sizeBytes : null,
    downloadCount: row.downloadCount,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    products: SUBJECT_EXPORT_PRODUCTS.map((product) => ({
      product,
      state:
        working && row.productProgress[product] === "waiting"
          ? "collecting"
          : row.productProgress[product],
    })),
  };
}
