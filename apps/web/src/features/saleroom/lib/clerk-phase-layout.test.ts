import { describe, expect, it } from "vitest";
import type { ClerkLivePhase } from "./clerk-live-phase";
import { CLERK_PHASE_LAYOUT } from "./clerk-phase-layout";

const PHASES: ClerkLivePhase[] = ["setup", "betweenLots", "selling", "paused"];

describe("CLERK_PHASE_LAYOUT", () => {
  it("defines config for every live phase", () => {
    for (const phase of PHASES) {
      expect(CLERK_PHASE_LAYOUT[phase]).toBeDefined();
      expect(CLERK_PHASE_LAYOUT[phase].sessionBarMode).toMatch(/full|live/);
    }
  });

  it("uses slim session bar during live phases", () => {
    expect(CLERK_PHASE_LAYOUT.selling.sessionBarMode).toBe("live");
    expect(CLERK_PHASE_LAYOUT.setup.sessionBarMode).toBe("full");
  });
});
