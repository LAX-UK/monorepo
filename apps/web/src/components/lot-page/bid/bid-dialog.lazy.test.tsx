import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runWhenIdle = vi.fn((task: () => void) => {
  task();
  return () => {};
});

vi.mock("@/lib/ui/run-when-idle", () => ({
  runWhenIdle: (task: () => void) => runWhenIdle(task),
}));

import {
  loadWithOneRetry,
  preloadBidDialog,
  resetBidDialogPreloadForTests,
  usePreloadBidDialogWhenIdle,
} from "./bid-dialog.lazy";

beforeEach(() => {
  runWhenIdle.mockClear();
  resetBidDialogPreloadForTests();
});

describe("loadWithOneRetry", () => {
  it("returns the first result without trying again", async () => {
    const load = vi.fn().mockResolvedValue("chunk");
    await expect(loadWithOneRetry(load)).resolves.toBe("chunk");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("tries once more when the first attempt fails", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("blip")).mockResolvedValue("chunk");
    await expect(loadWithOneRetry(load)).resolves.toBe("chunk");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("gives the second failure to the caller, and stops there", async () => {
    const load = vi.fn().mockRejectedValue(new Error("down"));
    await expect(loadWithOneRetry(load)).rejects.toThrow("down");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("preloadBidDialog", () => {
  it("shares one request however often it is asked for", async () => {
    const first = preloadBidDialog();
    const second = preloadBidDialog();
    expect(second).toBe(first);
    await expect(first).resolves.toHaveProperty("LotBidDialog");
  });
});

describe("usePreloadBidDialogWhenIdle", () => {
  it("fetches the dialog when the page is idle and bidding is possible", () => {
    renderHook(() => usePreloadBidDialogWhenIdle(true));
    expect(runWhenIdle).toHaveBeenCalledOnce();
  });

  it("fetches nothing where bidding is not possible", () => {
    renderHook(() => usePreloadBidDialogWhenIdle(false));
    expect(runWhenIdle).not.toHaveBeenCalled();
  });
});
