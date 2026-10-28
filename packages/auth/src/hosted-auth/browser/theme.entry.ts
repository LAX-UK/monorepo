import {
  HOSTED_THEME_STORAGE_KEY,
  type HostedTheme,
  otherTheme,
  resolveHostedTheme,
  themeToggleState,
} from "./theme.js";

/**
 * Loaded without `defer` in the head, so the theme class is set before the first paint. The toggle
 * is wired once the document has parsed. Storage can be blocked; the system setting then applies.
 */
function readSaved(): string | null {
  try {
    return localStorage.getItem(HOSTED_THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function apply(theme: HostedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

function current(): HostedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

apply(resolveHostedTheme(readSaved(), window.matchMedia("(prefers-color-scheme: dark)").matches));

function bindToggles(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")) {
    const labels = {
      toDark: button.dataset.labelDark ?? "Switch to dark theme",
      toLight: button.dataset.labelLight ?? "Switch to light theme",
    };
    const sync = () => {
      const state = themeToggleState(current(), labels);
      button.setAttribute("aria-label", state.label);
      button.setAttribute("aria-pressed", state.pressed);
    };
    sync();
    button.hidden = false;
    button.addEventListener("click", () => {
      const next = otherTheme(current());
      apply(next);
      try {
        localStorage.setItem(HOSTED_THEME_STORAGE_KEY, next);
      } catch {
        /* The choice still applies for this page view. */
      }
      sync();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindToggles, { once: true });
} else {
  bindToggles();
}
