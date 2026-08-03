import { describe, expect, it } from "vitest";
import {
  adminWorkItemsAssignmentFilterSchema,
  adminWorkItemsQuerySchema,
} from "./admin-work-items.js";

describe("adminWorkItemsQuerySchema", () => {
  it("defaults limit and assignment", () => {
    const parsed = adminWorkItemsQuerySchema.parse({});
    expect(parsed.limit).toBe(25);
    expect(parsed.assignment).toBe("all");
    expect(parsed.urgentOnly).toBe(false);
  });

  it("parses domain and urgentOnly", () => {
    const parsed = adminWorkItemsQuerySchema.parse({
      domain: "finance",
      urgentOnly: "true",
      limit: "10",
    });
    expect(parsed.domain).toBe("finance");
    expect(parsed.urgentOnly).toBe(true);
    expect(parsed.limit).toBe(10);
  });

  it("accepts assignment filters", () => {
    for (const assignment of ["mine", "unassigned", "all"] as const) {
      expect(adminWorkItemsAssignmentFilterSchema.parse(assignment)).toBe(assignment);
    }
  });
});
