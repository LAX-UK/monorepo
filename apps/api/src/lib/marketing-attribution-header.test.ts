import { describe, expect, it } from "vitest";
import {
  parseAttributionHeader,
  serializeAttributionHeader,
} from "./marketing-attribution-header.js";

describe("marketing attribution header", () => {
  it("rejects malformed and empty snapshots", () => {
    expect(parseAttributionHeader("not-json")).toBeNull();
    expect(parseAttributionHeader(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it("rejects values above the byte limit", () => {
    const oversized = JSON.stringify({
      version: 1,
      lastTouch: {
        capturedAt: "2026-01-01T00:00:00.000Z",
        landingPath: `/${"é".repeat(2_100)}`,
        utmSource: "newsletter",
      },
    });
    expect(oversized.length).toBeLessThan(4_096);
    expect(Buffer.byteLength(oversized, "utf8")).toBeGreaterThan(4_096);
    expect(parseAttributionHeader(oversized)).toBeNull();
  });

  it("round-trips a valid snapshot", () => {
    const snapshot = {
      version: 1 as const,
      lastTouch: {
        capturedAt: "2026-01-01T00:00:00.000Z",
        landingPath: "/campaign",
        utmCampaign: "spring",
      },
    };
    const serialized = serializeAttributionHeader(snapshot);
    expect(serialized).not.toBeNull();
    expect(parseAttributionHeader(serialized ?? undefined)).toEqual(snapshot);
  });
});
