import { describe, expect, it } from "vitest";
import { resolveQrCodeAnalyticsQuery } from "./qr.js";

describe("resolveQrCodeAnalyticsQuery", () => {
  const now = new Date("2026-06-13T15:30:00.000Z");

  it("defaults to 30 day daily range", () => {
    const resolved = resolveQrCodeAnalyticsQuery({}, now);
    expect(resolved.granularity).toBe("day");
    expect(resolved.source).toBe("daily");
    expect(resolved.rangeKey).toBe("30d");
    expect(resolved.from?.toISOString()).toBe("2026-05-15T00:00:00.000Z");
    expect(resolved.to).toEqual(now);
  });

  it("maps 24h to raw hourly window", () => {
    const resolved = resolveQrCodeAnalyticsQuery({ range: "24h" }, now);
    expect(resolved.granularity).toBe("hour");
    expect(resolved.source).toBe("raw");
    expect(resolved.from?.toISOString()).toBe("2026-06-12T15:30:00.000Z");
  });

  it("maps all to daily with no lower bound", () => {
    const resolved = resolveQrCodeAnalyticsQuery({ range: "all" }, now);
    expect(resolved.from).toBeNull();
    expect(resolved.source).toBe("daily");
  });

  it("supports legacy days param", () => {
    const resolved = resolveQrCodeAnalyticsQuery({ days: 7 }, now);
    expect(resolved.rangeKey).toBe("7d");
    expect(resolved.from?.toISOString()).toBe("2026-06-07T00:00:00.000Z");
  });

  it("uses raw hourly source for short custom ranges", () => {
    const resolved = resolveQrCodeAnalyticsQuery(
      {
        from: "2026-06-13T10:00:00.000Z",
        to: "2026-06-13T15:00:00.000Z",
      },
      now,
    );
    expect(resolved.granularity).toBe("hour");
    expect(resolved.source).toBe("raw");
    expect(resolved.rangeKey).toBe("custom");
  });

  it("uses daily source for longer custom ranges", () => {
    const resolved = resolveQrCodeAnalyticsQuery(
      {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-13T00:00:00.000Z",
      },
      now,
    );
    expect(resolved.granularity).toBe("day");
    expect(resolved.source).toBe("daily");
  });

  it("rejects invalid custom ranges", () => {
    expect(() =>
      resolveQrCodeAnalyticsQuery(
        { from: "2026-06-13T00:00:00.000Z", to: "2026-06-12T00:00:00.000Z" },
        now,
      ),
    ).toThrow("Invalid analytics date range");
  });
});
