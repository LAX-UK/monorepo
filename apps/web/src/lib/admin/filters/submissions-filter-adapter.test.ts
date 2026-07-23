import { submissionsFilterAdapter } from "@/lib/admin/filters/submissions-filter-adapter";
import { describe, expect, it } from "vitest";

describe("submissionsFilterAdapter", () => {
  it("serializes drawer shortcuts to existing query keys", () => {
    const current = new URLSearchParams("queue=pending&offset=20");
    const draft = {
      q: "vase",
      categoryId: "cat-1",
      assignedToMe: true,
      sortBySla: true,
      qualityGaps: true,
    };

    const href = submissionsFilterAdapter.buildHref("/admin/submissions", current, draft, {
      queue: "pending",
    });

    const params = new URL(href, "http://localhost").searchParams;
    expect(params.get("q")).toBe("vase");
    expect(params.get("categoryId")).toBe("cat-1");
    expect(params.get("assignedTo")).toBe("me");
    expect(params.get("sort")).toBe("sla");
    expect(params.get("qualityGaps")).toBe("1");
    expect(params.get("queue")).toBe("pending");
    expect(params.get("offset")).toBe("0");
  });

  it("reset defaults clear staged filters while preserving queue", () => {
    const defaults = submissionsFilterAdapter.defaults({});
    expect(defaults).toEqual({
      q: "",
      categoryId: "",
      assignedToMe: false,
      sortBySla: false,
      qualityGaps: false,
    });
  });
});
