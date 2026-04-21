import { afterEach, describe, expect, it, vi } from "vitest";
import { eagerTrigger, inViewTrigger } from "./triggers";

describe("eagerTrigger", () => {
  it("calls onReveal synchronously when bind runs", () => {
    const el = document.createElement("div");
    const onReveal = vi.fn();
    const cleanup = eagerTrigger.bind(el, onReveal);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});

describe("inViewTrigger", () => {
  const originalIO = globalThis.IntersectionObserver;

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO;
    vi.unstubAllGlobals();
  });

  it("calls onReveal when IntersectionObserver is undefined", () => {
    // @ts-expect-error test shim
    globalThis.IntersectionObserver = undefined;
    const el = document.createElement("div");
    const onReveal = vi.fn();
    const t = inViewTrigger();
    const cleanup = t.bind(el, onReveal);
    expect(onReveal).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("observes element and reveals on intersection, then disconnects on cleanup", () => {
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();

    globalThis.IntersectionObserver = class MockIO implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: ReadonlyArray<number> = [];
      takeRecords = vi.fn(() => []);

      constructor(public callback: IntersectionObserverCallback) {}

      observe(target: Element) {
        observeSpy(target);
        queueMicrotask(() => {
          this.callback(
            [{ isIntersecting: true, target, intersectionRatio: 1 } as IntersectionObserverEntry],
            this,
          );
        });
      }

      unobserve = vi.fn();
      disconnect = disconnectSpy;
    } as unknown as typeof IntersectionObserver;

    const el = document.createElement("div");
    const onReveal = vi.fn();
    const t = inViewTrigger();
    const cleanup = t.bind(el, onReveal);

    return new Promise<void>((resolve) => {
      queueMicrotask(() => {
        expect(observeSpy).toHaveBeenCalledWith(el);
        expect(onReveal).toHaveBeenCalledTimes(1);
        cleanup();
        expect(disconnectSpy).toHaveBeenCalled();
        resolve();
      });
    });
  });
});
