import { describe, expect, it } from "vitest";
import { viewerFromRegistrations } from "./cover-viewer";

describe("viewerFromRegistrations", () => {
  it("is anonymous with no registration", () => {
    expect(viewerFromRegistrations([])).toBe("anonymous");
  });

  it("ranks approved over pending over declined", () => {
    expect(viewerFromRegistrations(["rejected", "pending", "approved"])).toBe("approved");
    expect(viewerFromRegistrations(["rejected", "pending"])).toBe("pending");
    expect(viewerFromRegistrations(["rejected"])).toBe("declined");
  });

  it("ignores withdrawn registrations", () => {
    expect(viewerFromRegistrations(["withdrawn"])).toBe("anonymous");
  });
});
