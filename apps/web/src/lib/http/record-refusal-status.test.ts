import { describe, expect, it } from "vitest";
import { recordRefusalStatus } from "./record-refusal-status";

describe("recordRefusalStatus", () => {
  it("answers a refusal the same as a missing record", () => {
    expect(recordRefusalStatus(403)).toBe(404);
    expect(recordRefusalStatus(404)).toBe(404);
  });

  it("keeps the other client errors", () => {
    expect(recordRefusalStatus(401)).toBe(401);
    expect(recordRefusalStatus(409)).toBe(409);
  });

  it("treats a failed or unreachable API as unavailable", () => {
    expect(recordRefusalStatus(null)).toBe(503);
    expect(recordRefusalStatus(500)).toBe(503);
    expect(recordRefusalStatus(502)).toBe(503);
  });
});
