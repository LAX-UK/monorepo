import { describe, expect, it, vi } from "vitest";
import { InvoiceDueDateExtender } from "./invoice-due-date-extender.js";

describe("InvoiceDueDateExtender", () => {
  it("moves the due date to the term counted from the release (end of the London day, seven days on)", async () => {
    const extendDueAt = vi.fn().mockResolvedValue(true);
    const moved = await new InvoiceDueDateExtender({ extendDueAt }).extendAfterHold(
      "inv-1",
      new Date("2026-11-10T14:00:00.000Z"),
    );
    expect(moved).toBe(true);
    expect(extendDueAt).toHaveBeenCalledWith("inv-1", new Date("2026-11-17T23:59:59.999Z"));
  });

  it("reports that nothing moved when the stored due date is already later", async () => {
    const extendDueAt = vi.fn().mockResolvedValue(false);
    expect(
      await new InvoiceDueDateExtender({ extendDueAt }).extendAfterHold("inv-1", new Date()),
    ).toBe(false);
  });
});
