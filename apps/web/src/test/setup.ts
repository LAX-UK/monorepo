import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];

  constructor(private callback: IntersectionObserverCallback) {}

  observe = vi.fn((target: Element) => {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
  });

  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

class MockResizeObserver implements ResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}

  observe = vi.fn((target: Element) => {
    this.callback([{ target } as ResizeObserverEntry], this);
  });

  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
vi.stubGlobal("ResizeObserver", MockResizeObserver);

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

if (typeof globalThis.requestIdleCallback === "undefined") {
  vi.stubGlobal("requestIdleCallback", (cb: IdleRequestCallback) => {
    const id = setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
    return id as unknown as number;
  });
  vi.stubGlobal("cancelIdleCallback", (id: number) => {
    clearTimeout(id);
  });
}

afterEach(() => {
  cleanup();
});
