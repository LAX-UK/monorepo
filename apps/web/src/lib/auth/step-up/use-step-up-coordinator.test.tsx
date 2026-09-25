import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStepUpCoordinator } from "./use-step-up-coordinator";

describe("useStepUpCoordinator", () => {
  const assign = vi.fn();

  afterEach(() => {
    assign.mockReset();
  });

  it("redirects to hosted reauth for recent_auth_required", async () => {
    vi.stubGlobal("location", {
      ...window.location,
      pathname: "/dashboard/settings",
      search: "?tab=security",
      assign,
    });
    const { result } = renderHook(() => useStepUpCoordinator());
    await act(async () => {
      void result.current.request("recent_auth_required");
    });
    expect(assign).toHaveBeenCalledWith(
      "/api/auth/login?intent=reauth&next=%2Fdashboard%2Fsettings%3Ftab%3Dsecurity",
    );
    vi.unstubAllGlobals();
  });

  it("resolves cancelled on cancel from no_credential flow", async () => {
    const { result } = renderHook(() => useStepUpCoordinator());
    let gate!: Promise<"satisfied" | "cancelled">;
    await act(async () => {
      gate = result.current.request("credential_required");
    });
    expect(result.current.state.mode).toBe("no_credential");
    act(() => {
      result.current.cancel();
    });
    expect(await gate).toBe("cancelled");
    expect(result.current.state.mode).toBe("idle");
  });
});
