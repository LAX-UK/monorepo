import { mergeFilterSearchParams } from "@/lib/admin/filters/merge-filter-params";
import { describe, expect, it } from "vitest";

describe("mergeFilterSearchParams", () => {
  it("resets offset and applies draft patches", () => {
    const current = new URLSearchParams("q=foo&offset=40&limit=20");
    const next = mergeFilterSearchParams(
      current,
      { q: "bar", assignedTo: "me" },
      { queue: "pending" },
    );

    expect(next.get("q")).toBe("bar");
    expect(next.get("assignedTo")).toBe("me");
    expect(next.get("queue")).toBe("pending");
    expect(next.get("offset")).toBe("0");
    expect(next.get("limit")).toBe("20");
  });

  it("removes keys when patch value is empty or null", () => {
    const current = new URLSearchParams("sort=sla&qualityGaps=1&offset=10");
    const next = mergeFilterSearchParams(current, { sort: null, qualityGaps: "" }, {});

    expect(next.has("sort")).toBe(false);
    expect(next.has("qualityGaps")).toBe(false);
    expect(next.get("offset")).toBe("0");
  });
});
