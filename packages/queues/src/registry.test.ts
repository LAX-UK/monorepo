import { describe, expect, it } from "vitest";
import { atgSyncJobId } from "./exports.js";
import { redactPayload } from "./redaction.js";
import {
  ALL_QUEUE_NAMES,
  DEAD_LETTER_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  QUEUE_REGISTRY,
  listBullBoardQueues,
  listDlqSourceQueues,
  listEnabledQueues,
  listWorkerHeartbeatKeys,
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
    expect(QUEUE_REGISTRY.email.producers).toEqual(["api", "worker"]);
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

  it("enables atg-sync and its readiness heartbeat only behind the ATG flag", () => {
    const base = { appEnv: "production" as const, marketingEventsEnabled: false };
    expect(listEnabledQueues(base).map((q) => q.name)).not.toContain("atg-sync");
    expect(listWorkerHeartbeatKeys(base)).not.toContain("worker:heartbeat:atg-sync");

    const enabled = { ...base, atgSyncEnabled: true };
    expect(listEnabledQueues(enabled).map((q) => q.name)).toContain("atg-sync");
    expect(listWorkerHeartbeatKeys(enabled)).toContain("worker:heartbeat:atg-sync");
  });

  it("dedupes ATG jobs per target", () => {
    const ids = [
      atgSyncJobId({ name: "atg.push-sale", data: { saleId: "s1" } }),
      atgSyncJobId({ name: "atg.delete-lot", data: { lotId: "l1" } }),
    ];
    expect(ids).toEqual(["atg.push-sale__s1", "atg.delete-lot__l1"]);
    for (const id of ids) expect(id).not.toContain(":");
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
