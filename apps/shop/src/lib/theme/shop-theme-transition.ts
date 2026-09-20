export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function measureThemeRevealOrigin(button: HTMLElement | null): {
  x: number;
  y: number;
  radius: number;
} {
  const rect = button?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 32;
  const y = rect ? rect.top + rect.height / 2 : 32;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  return { x, y, radius };
}

/** Circular View Transitions reveal from the theme toggle. Falls back to an instant apply. */
export function revealShopThemeFromToggle(button: HTMLElement | null, apply: () => void): void {
  if (prefersReducedMotion()) {
    apply();
    return;
  }

  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition !== "function") {
    apply();
    return;
  }

  const origin = measureThemeRevealOrigin(button);
  const root = document.documentElement;
  root.style.setProperty("--theme-toggle-x", `${origin.x}px`);
  root.style.setProperty("--theme-toggle-y", `${origin.y}px`);
  root.style.setProperty("--theme-toggle-radius", `${origin.radius}px`);

  const cleanup = () => {
    root.style.removeProperty("--theme-toggle-x");
    root.style.removeProperty("--theme-toggle-y");
    root.style.removeProperty("--theme-toggle-radius");
  };

  try {
    const transition = doc.startViewTransition(apply);
    void transition.finished.finally(cleanup).catch(() => {
      /* Duplicate view-transition-name or aborted transition — theme already applied */
    });
  } catch {
    apply();
    cleanup();
  }
}
