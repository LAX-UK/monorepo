import { normalizeSessionStatus } from "@/lib/saleroom/normalize-session-status";
import { describe, expect, it } from "vitest";

describe("normalizeSessionStatus", () => {
  it("maps active to live", () => {
    expect(normalizeSessionStatus("active")).toBe("live");
    expect(normalizeSessionStatus("ACTIVE")).toBe("live");
  });

  it("returns known statuses unchanged", () => {
    expect(normalizeSessionStatus("paused")).toBe("paused");
    expect(normalizeSessionStatus("ended")).toBe("ended");
  });

  it("falls back to none for unknown values", () => {
    expect(normalizeSessionStatus("bogus")).toBe("none");
    expect(normalizeSessionStatus(null)).toBe("none");
  });
});
