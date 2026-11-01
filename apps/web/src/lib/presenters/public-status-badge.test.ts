import { describe, expect, it } from "vitest";
import { toPublicStatusBadgeProps } from "./public-status-badge";

describe("toPublicStatusBadgeProps", () => {
  it("draws live as the neutral badge with the live dot", () => {
    expect(toPublicStatusBadgeProps({ label: "Live", variant: "live", dot: true })).toEqual({
      tone: "neutral",
      live: true,
    });
  });

  it("keeps other tones and their dot", () => {
    expect(toPublicStatusBadgeProps({ label: "Extended", variant: "warning", dot: true })).toEqual({
      tone: "warning",
      shape: "dot",
    });
    expect(toPublicStatusBadgeProps({ label: "Sold", variant: "success" })).toEqual({
      tone: "success",
    });
  });
});
