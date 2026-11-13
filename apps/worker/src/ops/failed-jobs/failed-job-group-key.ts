import { createHash } from "node:crypto";
import type { FailedJobNeedsReviewGroup } from "@auction/persistence/interfaces";
import { failedJobNameLabel, failedJobTypeInfo, summariseError } from "@auction/queues";
import type { FailedJobGroup } from "./failed-jobs-alert-decision.js";

/** A code an error already starts with: `ZOHO_INVALID_DATA: …`, `RATE_LIMITED`. */
const LEADING_CODE = /^([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)(?=[:\s]|$)/;

/**
 * A short code that names an error without repeating it. An error that starts with its own code
 * keeps that code; any other gets `err-` and a fingerprint of its summary, the line Failed jobs
 * shows. Either way the alert carries no text from the error, so nothing personal leaves with it.
 */
export function errorCodeOf(errorLine: string): string {
  const leading = LEADING_CODE.exec(errorLine.trim());
  if (leading?.[1]) return leading[1];
  const summary = summariseError(errorLine);
  return `err-${createHash("sha256").update(summary).digest("hex").slice(0, 8)}`;
}

/** What the job type is called; integrations name their event and endpoint, as Failed jobs filters them. */
export function jobLabelOf(jobType: string, jobName: string | null): string {
  const separator = jobType.indexOf(":");
  const kind = separator > 0 ? jobType.slice(0, separator) : "";
  if (kind === "delivery" || kind === "webhook") {
    const endpoint = jobType.slice(separator + 1);
    const what = jobName ?? (kind === "delivery" ? "Delivery" : "Webhook");
    return kind === "delivery" ? `${what} to ${endpoint}` : `${what} webhook from ${endpoint}`;
  }
  const type = failedJobTypeInfo(jobType).label;
  const name = failedJobNameLabel(jobType, jobName);
  return name ? `${type} · ${name}` : type;
}

/**
 * Folds the rows the stores count (one per first error line) into the groups the alert names:
 * one job type and one error code. Lines that differ only in what the summary removes, or that
 * share a leading code, land in one group.
 */
export function toFailedJobGroups(rows: readonly FailedJobNeedsReviewGroup[]): FailedJobGroup[] {
  const groups = new Map<string, FailedJobGroup>();
  for (const row of rows) {
    const errorCode = errorCodeOf(row.errorLine);
    const key = [row.jobType, row.jobName ?? "", errorCode].join("\u0000");
    const seen = groups.get(key);
    groups.set(
      key,
      seen
        ? {
            ...seen,
            count: seen.count + row.count,
            newInWindow: seen.newInWindow + row.newSince,
            firstSeen: row.firstFailedAt < seen.firstSeen ? row.firstFailedAt : seen.firstSeen,
            lastSeen: row.lastFailedAt > seen.lastSeen ? row.lastFailedAt : seen.lastSeen,
          }
        : {
            key,
            jobType: row.jobType,
            jobLabel: jobLabelOf(row.jobType, row.jobName),
            errorCode,
            count: row.count,
            newInWindow: row.newSince,
            firstSeen: row.firstFailedAt,
            lastSeen: row.lastFailedAt,
          },
    );
  }
  return [...groups.values()];
}
