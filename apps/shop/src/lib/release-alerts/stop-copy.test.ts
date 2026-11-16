import { describe, expect, it } from "vitest";
import { stopCopy } from "./stop-copy";

describe("stopCopy", () => {
  it("keeps the release alert wording for a link that covers everything", () => {
    const copy = stopCopy(null);
    expect(copy.title).toBe("Stop release alerts");
    expect(copy.confirmLead("a•••@example.com")).toBe("Stop release alerts to a•••@example.com?");
  });

  it("names back in stock alerts, and says release alerts carry on", () => {
    const copy = stopCopy("back_in_stock");
    expect(copy.title).toBe("Stop back in stock alerts");
    expect(copy.confirmBody).toContain("Release alerts, if you have them, carry on.");
    expect(copy.doneBody("a•••@example.com").before).toContain("back in stock alerts");
  });
});
