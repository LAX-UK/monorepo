import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STAFF_UNDO_TOAST_DURATION_MS, toastUndo, useOptimisticState } from "./feedback.js";

// The real toaster is not mounted here; what matters is what is asked of it.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("toastUndo", () => {
  it("confirms the change with one Undo action, shown for 10 seconds", () => {
    const onUndo = vi.fn();
    toastUndo({ title: "Order LAX-10432 marked packed", onUndo });
    expect(toast.success).toHaveBeenCalledWith("Order LAX-10432 marked packed", {
      duration: STAFF_UNDO_TOAST_DURATION_MS,
      action: { label: "Undo", onClick: onUndo },
    });
    expect(STAFF_UNDO_TOAST_DURATION_MS).toBe(10_000);
  });
});

describe("useOptimisticState", () => {
  it("shows the new value at once and keeps it when the server agrees", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useOptimisticState("paid"));
    let commit: (value: { ok: true }) => void = () => {};
    let done: Promise<boolean> = Promise.resolve(false);
    act(() => {
      done = result.current[1](
        "packed",
        () =>
          new Promise((resolve) => {
            commit = resolve;
          }),
        { errorTitle: "Couldn't mark as packed", onSuccess },
      );
    });
    expect(result.current[0]).toBe("packed");
    expect(result.current[2]).toBe(true);
    await act(async () => {
      commit({ ok: true });
      await done;
    });
    expect(result.current[0]).toBe("packed");
    expect(onSuccess).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("puts the old value back and says why when the server refuses", async () => {
    const { result } = renderHook(() => useOptimisticState("paid"));
    await act(async () => {
      await result.current[1](
        "packed",
        async () => ({ ok: false, message: "The order was refunded elsewhere." }),
        { errorTitle: "Couldn't mark as packed" },
      );
    });
    expect(result.current[0]).toBe("paid");
    expect(toast.error).toHaveBeenCalledWith("Couldn't mark as packed", {
      description: "The order was refunded elsewhere.",
    });
  });

  it("also rolls back when the request throws", async () => {
    const { result } = renderHook(() => useOptimisticState(1));
    await act(async () => {
      await result.current[1](
        2,
        async () => {
          throw new Error("Network down");
        },
        { errorTitle: "Couldn't move the item" },
      );
    });
    expect(result.current[0]).toBe(1);
    expect(toast.error).toHaveBeenCalledWith("Couldn't move the item", {
      description: "Network down",
    });
  });

  it("follows the server's value after a refresh", () => {
    const { result, rerender } = renderHook(({ value }) => useOptimisticState(value), {
      initialProps: { value: "paid" },
    });
    rerender({ value: "shipped" });
    expect(result.current[0]).toBe("shipped");
  });
});
