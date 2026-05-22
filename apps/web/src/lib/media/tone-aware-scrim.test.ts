import { describe, expect, it } from "vitest";
import { toneAwareHeroScrimGradient, toneAwareScrimStops } from "./tone-aware-scrim";

describe("toneAwareScrimStops", () => {
  it("returns theme scrim tokens for light overlay tone", () => {
    const stops = toneAwareScrimStops("light");
    expect(stops.strong).toContain("scrim-hero");
    expect(stops.mid).toContain("scrim-hero");
  });

  it("builds a horizontal gradient string", () => {
    expect(toneAwareHeroScrimGradient("dark")).toMatch(/^linear-gradient/);
  });
});
