import { describe, expect, it } from "vitest";
import {
  assertQueueMutationAllowed,
  bullBoardAllowRetries,
  bullBoardReadOnlyInProd,
  isQueueMutationAllowed,
} from "./mutation-policy.js";
import { DEAD_LETTER_QUEUE_NAME } from "./registry.js";

describe("mutation policy", () => {
  it("blocks retry on high-criticality queues in production", () => {
    expect(isQueueMutationAllowed("email", "retry", "production")).toBe(false);
    expect(() => assertQueueMutationAllowed("email", "retry", "production")).toThrow("retries_disabled");
  });

  it("allows retry on low-criticality queues outside production", () => {
    expect(isQueueMutationAllowed("validate-upload", "retry", "development")).toBe(true);
    expect(bullBoardAllowRetries("validate-upload", "development")).toBe(true);
  });

  it("blocks pause on high-criticality queues in production", () => {
    expect(isQueueMutationAllowed("payout-settlement", "pause", "production")).toBe(false);
    expect(() => assertQueueMutationAllowed("payout-settlement", "pause", "production")).toThrow(
      "mutations_disabled_in_prod",
    );
  });

  it("allows pause on non-high-criticality queues with pause order in production", () => {
    expect(isQueueMutationAllowed("impersonation-sweeper", "pause", "production")).toBe(true);
  });

  it("matches Bull Board read-only flags", () => {
    expect(bullBoardReadOnlyInProd("email", "production")).toBe(true);
    expect(bullBoardReadOnlyInProd("validate-upload", "production")).toBe(false);
    expect(bullBoardAllowRetries("validate-upload", "production")).toBe(false);
  });

  it("throws pause_not_allowed when resuming a non-pausable queue", () => {
    expect(() => assertQueueMutationAllowed(DEAD_LETTER_QUEUE_NAME, "resume", "development")).toThrow(
      "pause_not_allowed",
    );
  });
});
