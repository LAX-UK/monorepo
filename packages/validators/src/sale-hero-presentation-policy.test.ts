import { describe, expect, it } from "vitest";
import {
  applyHeroPresentationPatch,
  isValidHeroPresentationState,
} from "./sale-hero-presentation-policy.js";

const YOUTUBE = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

describe("sale hero presentation policy", () => {
  it("preserves a persisted video URL for unrelated and presentation-only patches", () => {
    const existing = {
      heroPresentation: "video" as const,
      heroVideoUrl: YOUTUBE,
    };

    expect(applyHeroPresentationPatch(existing, {})).toEqual(existing);
    expect(applyHeroPresentationPatch(existing, { heroPresentation: "video" })).toEqual(existing);
  });

  it("detects a partial patch that would clear the URL from a video hero", () => {
    const next = applyHeroPresentationPatch(
      { heroPresentation: "video", heroVideoUrl: YOUTUBE },
      { heroVideoUrl: null },
    );

    expect(isValidHeroPresentationState(next)).toBe(false);
  });

  it("accepts marketing video for every delivery-mode-independent hero state", () => {
    expect(
      isValidHeroPresentationState({
        heroPresentation: "video",
        heroVideoUrl: YOUTUBE,
      }),
    ).toBe(true);
  });
});
