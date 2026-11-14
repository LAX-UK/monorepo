import { resolveClerkSessionControls } from "@/features/saleroom/lib/clerk-session-controls";
import { describe, expect, it } from "vitest";

describe("resolveClerkSessionControls", () => {
  it("offers Pause only on a room the server confirmed live", () => {
    expect(resolveClerkSessionControls({ status: "live", confirming: false })).toEqual({
      canGoLive: false,
      canPause: true,
      canResume: false,
      canClose: true,
    });
    for (const status of ["none", "pending", "paused", "ended"] as const) {
      expect(resolveClerkSessionControls({ status, confirming: false }).canPause).toBe(false);
    }
  });

  it("offers Resume only on a room the server confirmed paused", () => {
    expect(resolveClerkSessionControls({ status: "paused", confirming: false })).toEqual({
      canGoLive: false,
      canPause: false,
      canResume: true,
      canClose: true,
    });
    for (const status of ["none", "pending", "live", "ended"] as const) {
      expect(resolveClerkSessionControls({ status, confirming: false }).canResume).toBe(false);
    }
  });

  it("offers Go live before the room opens and after it has closed", () => {
    for (const status of ["none", "pending", "ended"] as const) {
      expect(resolveClerkSessionControls({ status, confirming: false })).toEqual({
        canGoLive: true,
        canPause: false,
        canResume: false,
        canClose: false,
      });
    }
  });

  it("offers nothing while a control waits for the server to confirm the new state", () => {
    for (const status of ["none", "pending", "live", "paused", "ended"] as const) {
      expect(resolveClerkSessionControls({ status, confirming: true })).toEqual({
        canGoLive: false,
        canPause: false,
        canResume: false,
        canClose: false,
      });
    }
  });
});
