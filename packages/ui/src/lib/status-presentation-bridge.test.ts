import { describe, expect, it } from "vitest";
import {
  presentationToDotStatus,
  statusBadgeVariantToDotTone,
} from "./status-presentation-bridge.js";

describe("statusBadgeVariantToDotTone", () => {
  it("maps all registry variants to dot tones", () => {
    expect(statusBadgeVariantToDotTone("live")).toBe("live");
    expect(statusBadgeVariantToDotTone("success")).toBe("success");
    expect(statusBadgeVariantToDotTone("info")).toBe("info");
    expect(statusBadgeVariantToDotTone("warning")).toBe("warning");
    expect(statusBadgeVariantToDotTone("danger")).toBe("critical");
    expect(statusBadgeVariantToDotTone("neutral")).toBe("neutral");
  });
});

describe("presentationToDotStatus", () => {
  it("bridges label and variant together", () => {
    expect(presentationToDotStatus({ label: "Live", variant: "live" })).toEqual({
      label: "Live",
      tone: "live",
    });
    expect(presentationToDotStatus({ label: "Cancelled", variant: "danger" })).toEqual({
      label: "Cancelled",
      tone: "critical",
    });
  });
});
