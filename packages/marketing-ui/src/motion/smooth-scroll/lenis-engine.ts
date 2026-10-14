import Lenis from "lenis";
import type { ScrollTarget, ScrollToOptions, SmoothScrollEngine } from "./engine.js";

function headerOffset(): number {
  if (typeof document === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--marketing-header-height",
  );
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? -parsed : 0;
}

export function createLenisEngine(): SmoothScrollEngine {
  const lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    syncTouch: false,
    autoRaf: true,
    anchors: {
      offset: headerOffset(),
    },
  });

  return {
    scrollTo(target, options) {
      return new Promise<void>((resolve) => {
        lenis.scrollTo(target, {
          offset: options?.offset ?? 0,
          immediate: options?.immediate ?? false,
          onComplete: () => resolve(),
        });
      });
    },
    sync() {
      lenis.scrollTo(window.scrollY, { immediate: true, force: true });
    },
    stop() {
      lenis.stop();
    },
    start() {
      lenis.start();
    },
    destroy() {
      lenis.destroy();
    },
  };
}

export type { ScrollTarget, ScrollToOptions };
