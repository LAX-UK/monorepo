import { act, render, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDeferredModule } from "./use-deferred-module";

afterEach(() => {
  vi.useRealTimers();
});

describe("useDeferredModule", () => {
  it("does not fetch until it is enabled", () => {
    const load = vi.fn(() => Promise.resolve("part"));
    const { result } = renderHook(() => useDeferredModule(load, false));
    expect(result.current.status).toBe("idle");
    expect(load).not.toHaveBeenCalled();
  });

  it("is loading, then ready with the module", async () => {
    const load = () => Promise.resolve("part");
    const { result } = renderHook(() => useDeferredModule(load, true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.value).toBe("part");
  });

  it("fails when the import is rejected and retries on request", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("chunk"))
      .mockResolvedValueOnce("part");
    const { result } = renderHook(() => useDeferredModule(load, true));
    await waitFor(() => expect(result.current.status).toBe("failed"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("fails when the part takes longer than the timeout, and recovers if it arrives", async () => {
    vi.useFakeTimers();
    let arrive: (value: string) => void = () => {};
    const load = () =>
      new Promise<string>((resolve) => {
        arrive = resolve;
      });
    const { result } = renderHook(() => useDeferredModule(load, true, 1000));
    expect(result.current.status).toBe("loading");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.status).toBe("failed");
    await act(async () => {
      arrive("late");
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.value).toBe("late");
  });

  it("is ready on the first render of a later mount once the module has arrived", async () => {
    const load = vi.fn(() => Promise.resolve("part"));
    const first = renderHook(() => useDeferredModule(load, true));
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    first.unmount();

    const seen: string[] = [];
    const { result } = renderHook(() => {
      const state = useDeferredModule(load, false);
      seen.push(state.status);
      return state;
    });
    expect(seen[0]).toBe("ready");
    expect(result.current.value).toBe("part");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("draws the stand-in while server HTML hydrates, even when the module has arrived", async () => {
    const load = () => Promise.resolve("part");
    const warm = renderHook(() => useDeferredModule(load, true));
    await waitFor(() => expect(warm.result.current.status).toBe("ready"));
    warm.unmount();

    const seen: string[] = [];
    function Part() {
      const state = useDeferredModule(load, true);
      seen.push(state.status);
      return <span>{state.status === "ready" ? state.value : "stand-in"}</span>;
    }
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Part />);
    document.body.append(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Part />, { container, hydrate: true });
    expect(seen[1]).toBe("idle");
    await waitFor(() => expect(container).toHaveTextContent("part"));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    container.remove();
  });
});
