import { describe, expect, it } from "vitest";
import { replyByLabel } from "./bid-enquiry-received.js";

describe("replyByLabel", () => {
  it("names the London day the reply is promised, weekday first", () => {
    expect(replyByLabel("2026-11-04T12:00:00Z")).toBe("Wednesday 4 November");
  });

  it("reads the London day across summer time and the clock changes", () => {
    expect(replyByLabel("2026-06-30T23:30:00Z")).toBe("Wednesday 1 July");
    expect(replyByLabel("2026-10-24T23:30:00Z")).toBe("Sunday 25 October");
    expect(replyByLabel("2026-10-25T23:30:00Z")).toBe("Sunday 25 October");
    expect(replyByLabel("2026-03-28T23:30:00Z")).toBe("Saturday 28 March");
  });
});
