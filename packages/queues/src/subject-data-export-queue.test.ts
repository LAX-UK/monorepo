import { describe, expect, it } from "vitest";
import { subjectDataExportJobId } from "./exports.js";
import { QUEUE_REGISTRY, SUBJECT_DATA_EXPORT_QUEUE_NAME } from "./registry.js";

/** Mirrors SUBJECT_EXPORT_PRODUCT_RETRY_HOURS in the identity contract. */
const RETRY_HOURS = 72;

describe("subject-data-export queue", () => {
  it("keys one job per request so a relayed event twice enqueues once", () => {
    expect(subjectDataExportJobId("3f2c")).toBe(subjectDataExportJobId("3f2c"));
    expect(subjectDataExportJobId("3f2c")).not.toBe(subjectDataExportJobId("9a1b"));
    expect(subjectDataExportJobId("3f2c")).not.toContain(":");
  });

  it("keeps retrying for the 72 hours the design allows, and no longer", () => {
    const { attempts, backoff } = QUEUE_REGISTRY[SUBJECT_DATA_EXPORT_QUEUE_NAME].defaultJobOptions;
    // The wait before attempt n (n >= 2) is delay * 2^(n-2), so the last attempt starts at
    // delay * (2^(attempts-1) - 1) after the first.
    const lastAttemptAtHours = (backoff.delay * (2 ** (attempts - 1) - 1)) / 3_600_000;
    expect(lastAttemptAtHours).toBeLessThanOrEqual(RETRY_HOURS);
    expect(lastAttemptAtHours).toBeGreaterThan(RETRY_HOURS - 2);
  });

  it("is consumed by the worker and its failures reach the failed jobs list", () => {
    expect(QUEUE_REGISTRY[SUBJECT_DATA_EXPORT_QUEUE_NAME]).toMatchObject({
      consumer: "worker",
      dlq: true,
      showInUi: true,
    });
  });
});
