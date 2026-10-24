import { describe, expect, it } from "vitest";
import { formatWorkItemAmount } from "./drizzle-admin-work-items.reader.js";

describe("formatWorkItemAmount", () => {
  it("shows a stored decimal amount as pounds", () => {
    expect(formatWorkItemAmount("83750.00")).toBe("£83,750.00");
    expect(formatWorkItemAmount("4750.5")).toBe("£4,750.50");
  });

  it("leaves a non-numeric value as it came", () => {
    expect(formatWorkItemAmount("n/a")).toBe("n/a");
  });
});
