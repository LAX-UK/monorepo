import { describe, expect, it } from "vitest";
import { slaBadgeLabel } from "./submission-header-badges";

describe("slaBadgeLabel", () => {
  it("says Over SLA once when the countdown already says it", () => {
    expect(slaBadgeLabel(true, "Over SLA")).toBe("Over SLA");
  });
  it("prefixes a running countdown that is over the SLA", () => {
    expect(slaBadgeLabel(true, "3h left")).toBe("Over SLA — 3h left");
  });
  it("labels an at-risk countdown", () => {
    expect(slaBadgeLabel(false, "2d left")).toBe("SLA at risk — 2d left");
  });
});
