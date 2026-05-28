import { describe, expect, it } from "vitest";
import { redactPayload } from "./redaction.js";
import {
  ALL_QUEUE_NAMES,
  DEAD_LETTER_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  QUEUE_REGISTRY,
  listBullBoardQueues,
  listDlqSourceQueues,
  listEnabledQueues,
} from "./registry.js";

describe("QUEUE_REGISTRY", () => {
  it("includes all expected BullMQ queue names", () => {
    expect(ALL_QUEUE_NAMES).toContain(EMAIL_QUEUE_NAME);
    expect(ALL_QUEUE_NAMES).toContain(DEAD_LETTER_QUEUE_NAME);
    expect(ALL_QUEUE_NAMES.length).toBeGreaterThanOrEqual(17);
  });

  it("marks email as hidden from Bull Board UI", () => {
    expect(QUEUE_REGISTRY.email.showInUi).toBe(false);
    expect(QUEUE_REGISTRY.email.allowUiRetries).toBe(false);
  });

  it("filters env-conditional queues", () => {
    const all = listEnabledQueues({
      appEnv: "development",
      marketingEventsEnabled: false,
      cronInternalSecret: undefined,
    });
    const names = all.map((q) => q.name);
    expect(names).not.toContain("marketing-events");
    expect(names).not.toContain("payout-settlement");
  });

  it("includes marketing and payout settlement when enabled", () => {
    const all = listEnabledQueues({
      appEnv: "production",
      marketingEventsEnabled: true,
      cronInternalSecret: "x".repeat(32),
    });
    const names = all.map((q) => q.name);
    expect(names).toContain("marketing-events");
    expect(names).toContain("payout-settlement");
  });

  it("excludes hidden queues from Bull Board list", () => {
    const ui = listBullBoardQueues({
      appEnv: "development",
      marketingEventsEnabled: true,
      cronInternalSecret: "secret",
    });
    expect(ui.some((q) => q.name === "email")).toBe(false);
  });

  it("lists DLQ sources for critical queues", () => {
    const dlq = listDlqSourceQueues();
    expect(dlq.some((q) => q.name === "email")).toBe(true);
    expect(dlq.some((q) => q.name === "payout-settlement")).toBe(true);
  });
});

describe("redactPayload", () => {
  it("redacts sensitive keys", () => {
    const out = redactPayload({
      uploadId: "abc",
      email: "user@example.com",
      vars: { body: "secret html" },
    }) as Record<string, unknown>;
    expect(out.uploadId).toBe("abc");
    expect(out.email).toBe("[redacted]");
    expect(out.vars).toBe("[redacted]");
  });
});
