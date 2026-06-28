import { describe, expect, it } from "vitest";
import { pressArchiveQuerySchema } from "./press.js";

describe("pressArchiveQuerySchema", () => {
  it("defaults limit and offset", () => {
    const parsed = pressArchiveQuerySchema.parse({});
    expect(parsed.limit).toBe(100);
    expect(parsed.offset).toBe(0);
  });

  it("rejects limit above 200", () => {
    expect(() => pressArchiveQuerySchema.parse({ limit: 201 })).toThrow();
  });

  it("accepts mentionType filter", () => {
    const parsed = pressArchiveQuerySchema.parse({ mentionType: "feature" });
    expect(parsed.mentionType).toBe("feature");
  });

  it("accepts year and q filters", () => {
    const parsed = pressArchiveQuerySchema.parse({ year: 2026, q: "Daily Mail" });
    expect(parsed.year).toBe(2026);
    expect(parsed.q).toBe("Daily Mail");
  });
});
