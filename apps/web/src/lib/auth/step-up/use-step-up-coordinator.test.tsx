import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IStepUpAuthenticator } from "./step-up-authenticator.client";
import { useStepUpCoordinator } from "./use-step-up-coordinator";

describe("useStepUpCoordinator", () => {
  it("resolves satisfied after successful password proof", async () => {
    const authenticator: IStepUpAuthenticator = {
      verifyPassword: vi.fn().mockResolvedValue("ok"),
    };
    const { result } = renderHook(() => useStepUpCoordinator(authenticator));
    let gate!: Promise<"satisfied" | "cancelled">;
    await act(async () => {
      gate = result.current.request("recent_auth_required");
    });
    expect(result.current.state.mode).toBe("password");
    await act(async () => {
      await result.current.submitPassword("secret");
    });
    expect(await gate).toBe("satisfied");
    expect(result.current.state.mode).toBe("idle");
    expect(authenticator.verifyPassword).toHaveBeenCalledWith("secret");
  });

  it("switches to no_credential when authenticator returns no_credential", async () => {
    const authenticator: IStepUpAuthenticator = {
      verifyPassword: vi.fn().mockResolvedValue("no_credential"),
    };
    const { result } = renderHook(() => useStepUpCoordinator(authenticator));
    await act(async () => {
      void result.current.request("recent_auth_required");
    });
    await act(async () => {
      await result.current.submitPassword("any");
    });
    expect(result.current.state.mode).toBe("no_credential");
  });

  it("resolves cancelled on cancel from no_credential flow", async () => {
    const { result } = renderHook(() =>
      useStepUpCoordinator({ verifyPassword: vi.fn().mockResolvedValue("ok") }),
    );
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
