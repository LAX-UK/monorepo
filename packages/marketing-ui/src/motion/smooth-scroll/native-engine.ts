import type { ScrollTarget, SmoothScrollEngine } from "./engine.js";

function resolveScrollTop(target: ScrollTarget, offset: number): number {
  if (typeof target === "number") return target + offset;
  if (typeof target === "string") {
    const el = document.querySelector(target);
    if (!el) return window.scrollY;
    const top = el.getBoundingClientRect().top + window.scrollY;
    return top + offset;
  }
  const top = target.getBoundingClientRect().top + window.scrollY;
  return top + offset;
}

export function createNativeEngine(): SmoothScrollEngine {
  return {
    scrollTo(target, options) {
      const offset = options?.offset ?? 0;
      const top = resolveScrollTop(target, offset);
      window.scrollTo({ top, behavior: options?.immediate ? "auto" : "smooth" });
      return Promise.resolve();
    },
    sync() {},
    stop() {},
    start() {},
    destroy() {},
  };
}
