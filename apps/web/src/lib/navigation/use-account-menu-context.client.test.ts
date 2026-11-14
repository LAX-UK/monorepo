import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/bids" }));

const context = { accounts: [{ id: "acc-1", current: true }], pendingInvitations: [] };

async function loadHook() {
  // A fresh module each test: the hook keeps a per-person cache at module level.
  vi.resetModules();
  return import("@/lib/navigation/use-account-menu-context.client");
}

describe("useAccountMenuContext", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads the facts again after a 503, so the phone account button still appears", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => context });
    const { useAccountMenuContext } = await loadHook();

    const { result } = renderHook(() => useAccountMenuContext("user-1", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(context);
  });

  it("stops after a few failed reads", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { useAccountMenuContext, ACCOUNT_MENU_CONTEXT_RETRY_MS } = await loadHook();

    const { result } = renderHook(() => useAccountMenuContext("user-1", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(ACCOUNT_MENU_CONTEXT_RETRY_MS.length + 1);
    expect(result.current).toBeNull();
  });

  it("does not read again once the component has gone", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    const { useAccountMenuContext } = await loadHook();

    const { unmount } = renderHook(() => useAccountMenuContext("user-1", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
