import { vi } from "vitest";

type FakeTransition = { finish: () => void; abort: () => void };

/**
 * Installs `document.startViewTransition` with the browser's ordering (View Transitions spec):
 * starting a transition first settles the running one's `finished`, and each update callback runs
 * in a later task, after the old state is captured. `flush()` lets queued updates and promise
 * callbacks run. Call `uninstall()` in `afterEach`.
 */
export function installFakeViewTransitions() {
  const transitions: FakeTransition[] = [];
  let settleRunning: (() => void) | undefined;
  const start = vi.fn((update: () => void) => {
    settleRunning?.();
    let resolve: () => void = () => undefined;
    let reject: (error: Error) => void = () => undefined;
    const finished = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    settleRunning = resolve;
    setTimeout(update, 0);
    transitions.push({ finish: resolve, abort: () => reject(new Error("update failed")) });
    return { finished };
  });
  (document as { startViewTransition?: unknown }).startViewTransition = start;
  return {
    start,
    transitions,
    flush: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
    uninstall: () => {
      (document as { startViewTransition?: unknown }).startViewTransition = undefined;
    },
  };
}

/** Stubs `matchMedia` so only the reduced-motion query matches, when `reduced` is true. */
export function stubReducedMotionQuery(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduced-motion") ? reduced : false,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
}
