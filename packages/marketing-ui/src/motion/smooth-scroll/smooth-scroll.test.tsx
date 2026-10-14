import { render, waitFor } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SmoothScrollEngine, SmoothScrollEngineFactory } from "./engine.js";
import { observeScrollLock } from "./scroll-lock.js";
import { useSmoothScroll } from "./smooth-scroll-context.js";
import { SmoothScroll } from "./smooth-scroll.js";

vi.mock("./scroll-lock.js", () => ({
  observeScrollLock: vi.fn(() => () => {}),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

function createFakeEngine(): SmoothScrollEngine & {
  sync: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  scrollTo: ReturnType<typeof vi.fn>;
} {
  return {
    scrollTo: vi.fn(() => Promise.resolve()),
    sync: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    destroy: vi.fn(),
  };
}

describe("SmoothScroll", () => {
  afterEach(() => {
    document.documentElement.classList.remove("lenis", "lenis-smooth", "lenis-stopped");
    vi.mocked(observeScrollLock).mockClear();
  });

  it("uses native engine when reduced motion is preferred", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query.includes("reduce"),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const factory = vi.fn(createFakeEngine) satisfies SmoothScrollEngineFactory;
    render(
      <SmoothScroll createEngine={factory}>
        <span>child</span>
      </SmoothScroll>,
    );
    await waitFor(() => {
      expect(factory).not.toHaveBeenCalled();
    });
  });

  it("uses native engine when the app forces reduced motion", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      () =>
        ({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const factory = vi.fn(createFakeEngine) satisfies SmoothScrollEngineFactory;
    render(
      <SmoothScroll createEngine={factory} reducedMotion>
        <span>child</span>
      </SmoothScroll>,
    );
    await waitFor(() => {
      expect(factory).not.toHaveBeenCalled();
    });
  });

  it("calls sync on pathname change", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      () =>
        ({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const engine = createFakeEngine();
    const factory = vi.fn(() => engine);
    const pathname = vi.mocked(usePathname);
    pathname.mockReturnValue("/a");
    const { rerender } = render(
      <SmoothScroll createEngine={factory}>
        <span>child</span>
      </SmoothScroll>,
    );
    await waitFor(() => expect(factory).toHaveBeenCalled());
    pathname.mockReturnValue("/b");
    rerender(
      <SmoothScroll createEngine={factory}>
        <span>child</span>
      </SmoothScroll>,
    );
    await waitFor(() => expect(engine.sync).toHaveBeenCalled());
  });

  it("pauses and resumes on scroll lock", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      () =>
        ({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const engine = createFakeEngine();
    let lockHandler: ((locked: boolean) => void) | undefined;
    vi.mocked(observeScrollLock).mockImplementation((onChange) => {
      lockHandler = onChange;
      return () => {};
    });
    render(
      <SmoothScroll createEngine={() => engine}>
        <span>child</span>
      </SmoothScroll>,
    );
    await waitFor(() => expect(lockHandler).toBeDefined());
    lockHandler?.(true);
    expect(engine.stop).toHaveBeenCalled();
    lockHandler?.(false);
    expect(engine.start).toHaveBeenCalled();
  });

  it("destroys the engine on unmount", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      () =>
        ({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const engine = createFakeEngine();
    const { unmount: unmountTree } = render(
      <SmoothScroll createEngine={() => engine}>
        <span>child</span>
      </SmoothScroll>,
    );
    await waitFor(() => expect(engine.destroy).not.toHaveBeenCalled());
    unmountTree();
    expect(engine.destroy).toHaveBeenCalled();
  });
});

describe("useSmoothScroll", () => {
  it("returns scrollTo outside provider", () => {
    function Probe() {
      const { scrollTo } = useSmoothScroll();
      expect(typeof scrollTo).toBe("function");
      return null;
    }
    render(<Probe />);
  });
});
