import { describe, expect, it } from "vitest";
import {
  displayBidRowClassName,
  displayLeadingBidRowClassName,
  displaySessionStatusPresentation,
} from "./display-session-status-presentation";

describe("displaySessionStatusPresentation", () => {
  it("maps live session to emerald AV styling", () => {
    expect(displaySessionStatusPresentation("live")).toEqual({
      label: "LIVE",
      className: "bg-emerald-500/20 text-emerald-100 border-emerald-400/40",
    });
  });

  it("maps paused to amber AV styling", () => {
    expect(displaySessionStatusPresentation("paused").label).toBe("PAUSED");
    expect(displaySessionStatusPresentation("paused").className).toContain("amber");
  });

  it("maps pending to standby AV styling", () => {
    expect(displaySessionStatusPresentation("pending").label).toBe("STANDBY");
  });
});

describe("display bid feed row classes", () => {
  it("includes reduced-motion guards", () => {
    expect(displayLeadingBidRowClassName).toContain("motion-reduce:animate-none");
    expect(displayBidRowClassName).toContain("motion-reduce:animate-none");
  });
});
