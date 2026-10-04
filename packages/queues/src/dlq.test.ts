import { describe, expect, it } from "vitest";
import { bullMqSafeJobId, dlqJobId, dlqRedisJobId, jobAttemptsExhausted } from "./dlq.js";
import { QUEUE_REGISTRY } from "./registry.js";

describe("dlqJobId", () => {
  it("builds stable idempotent ids", () => {
    expect(dlqJobId("email", "job-1")).toBe("dlq:email:job-1");
  });
});

describe("bullMqSafeJobId", () => {
  it("removes colons for BullMQ custom job ids", () => {
    expect(bullMqSafeJobId("dlq:email:repeat:abc")).toBe("dlq-email-repeat-abc");
    expect(bullMqSafeJobId("outbox-1")).toBe("outbox-1");
  });
});

describe("dlqRedisJobId", () => {
  it("never contains colons", () => {
    const id = dlqRedisJobId("email", dlqJobId("email", "repeat:abc:123"), 1_700_000_000_000);
    expect(id).not.toContain(":");
    expect(id).toBe("dlq-email-repeat-abc-123-1700000000000");
  });
});

describe("jobAttemptsExhausted", () => {
  const emailDef = QUEUE_REGISTRY.email;

  it("uses registry default attempts when job opts omit attempts", () => {
    expect(jobAttemptsExhausted({ attemptsMade: 4, opts: {} }, emailDef)).toBe(false);
    expect(jobAttemptsExhausted({ attemptsMade: 5, opts: {} }, emailDef)).toBe(true);
  });

  it("respects explicit job opts attempts", () => {
    expect(jobAttemptsExhausted({ attemptsMade: 2, opts: { attempts: 3 } }, emailDef)).toBe(false);
    expect(jobAttemptsExhausted({ attemptsMade: 3, opts: { attempts: 3 } }, emailDef)).toBe(true);
  });
});
