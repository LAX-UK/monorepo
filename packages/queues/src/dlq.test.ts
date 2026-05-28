import { describe, expect, it } from "vitest";
import { dlqJobId, jobAttemptsExhausted } from "./dlq.js";
import { QUEUE_REGISTRY } from "./registry.js";

describe("dlqJobId", () => {
  it("builds stable idempotent ids", () => {
    expect(dlqJobId("email", "job-1")).toBe("dlq:email:job-1");
  });
});

describe("jobAttemptsExhausted", () => {
  const emailDef = QUEUE_REGISTRY.email;

  it("uses registry default attempts when job opts omit attempts", () => {
    expect(
      jobAttemptsExhausted({ attemptsMade: 4, opts: {} }, emailDef),
    ).toBe(false);
    expect(
      jobAttemptsExhausted({ attemptsMade: 5, opts: {} }, emailDef),
    ).toBe(true);
  });

  it("respects explicit job opts attempts", () => {
    expect(
      jobAttemptsExhausted({ attemptsMade: 2, opts: { attempts: 3 } }, emailDef),
    ).toBe(false);
    expect(
      jobAttemptsExhausted({ attemptsMade: 3, opts: { attempts: 3 } }, emailDef),
    ).toBe(true);
  });
});
