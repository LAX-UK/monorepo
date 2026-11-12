import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preloadToastWhenIdle } from "./toast-preload";

const idle: Array<() => void> = [];

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, "readyState", { value: state, configurable: true });
}

beforeEach(() => {
  idle.length = 0;
  vi.stubGlobal("requestIdleCallback", (task: () => void) => idle.push(task));
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  setReadyState("complete");
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "connection");
});

describe("preloadToastWhenIdle", () => {
  it("preloads when the browser is idle after the page has loaded", () => {
    const preload = vi.fn();
    preloadToastWhenIdle(preload);
    expect(preload).not.toHaveBeenCalled();
    idle[0]?.();
    expect(preload).toHaveBeenCalledOnce();
  });

  it("waits for the load event while the page is still loading", () => {
    setReadyState("loading");
    const preload = vi.fn();
    preloadToastWhenIdle(preload);
    expect(idle).toHaveLength(0);
    window.dispatchEvent(new Event("load"));
    idle[0]?.();
    expect(preload).toHaveBeenCalledOnce();
  });

  it("does nothing on Save-Data or a 2g connection", () => {
    for (const connection of [
      { saveData: true },
      { effectiveType: "2g" },
      { effectiveType: "slow-2g" },
    ]) {
      Object.defineProperty(navigator, "connection", { value: connection, configurable: true });
      preloadToastWhenIdle(vi.fn());
    }
    expect(idle).toHaveLength(0);
  });

  it("can be cancelled before it runs", () => {
    setReadyState("loading");
    const preload = vi.fn();
    const cancel = preloadToastWhenIdle(preload);
    cancel();
    window.dispatchEvent(new Event("load"));
    expect(idle).toHaveLength(0);
  });
});
