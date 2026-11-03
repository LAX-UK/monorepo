import { SUBJECT_EXPORT_PRODUCT_RETRY_HOURS } from "@auction/identity-contracts";
import type { SubjectExportError } from "./subject-export.errors.js";

const HOUR_MS = 3_600_000;

export type FailureDecision =
  /** Try again later; nothing is reported yet. */
  | { action: "retry" }
  /** A product has not answered for the whole retry window: report it as delayed and stop. */
  | { action: "delay"; product: NonNullable<SubjectExportError["product"]> }
  /** Nothing more can be done: report failed and stop. */
  | { action: "fail" };

/**
 * What to do after an attempt failed. A permanent error fails the request. A transient one is
 * retried until the 72 hours are used or the attempts run out; if a product was the cause the
 * request is then `delayed` (staff are alerted and nothing partial ships), otherwise it `failed`.
 */
export function decideFailure(input: {
  error: SubjectExportError;
  /** Time since the job was queued. */
  elapsedMs: number;
  /** This attempt, counting from 1. */
  attempt: number;
  maxAttempts: number;
  retryHours?: number;
}): FailureDecision {
  const { error } = input;
  if (error.kind === "permanent") return { action: "fail" };
  const windowMs = (input.retryHours ?? SUBJECT_EXPORT_PRODUCT_RETRY_HOURS) * HOUR_MS;
  const spent = input.elapsedMs >= windowMs || input.attempt >= input.maxAttempts;
  if (!spent) return { action: "retry" };
  return error.product ? { action: "delay", product: error.product } : { action: "fail" };
}
