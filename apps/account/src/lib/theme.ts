export const THEME_STORAGE_KEY = "lax-account-theme";

export type ThemePreference = "light" | "dark";

/**
 * Runs before first paint so `html.dark` is set without a flash. A saved choice wins; otherwise
 * the system setting decides. Storage can be blocked, in which case the system setting applies.
 */
export const THEME_INIT_SNIPPET = `(function(){try{var m=null;try{m=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}if(m!=="light"&&m!=="dark"){m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.toggle("dark",m==="dark")}catch(e){}})();`;

/** Applies and remembers a theme choice for this origin. */
export function applyTheme(mode: ThemePreference): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* The choice still applies for this page view. */
  }
}
