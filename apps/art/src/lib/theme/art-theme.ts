export const ART_THEME_COOKIE = "lax_theme";
export const ART_THEME_STORAGE_KEY = "theme";
export const ART_THEME_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;
export const ART_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export type ArtThemePreference = "light" | "dark";

export function parseArtTheme(raw: string | null | undefined): ArtThemePreference | null {
  if (raw === "light" || raw === "dark") return raw;
  return null;
}

export function artThemeIsDark(
  preference: ArtThemePreference | null,
  prefersDark: boolean,
): boolean {
  if (preference === "dark") return true;
  if (preference === "light") return false;
  return prefersDark;
}

export function toggleArtTheme(isDark: boolean): ArtThemePreference {
  return isDark ? "light" : "dark";
}

function applyArtThemeClass(mode: ArtThemePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
}

export function applyArtTheme(mode: ArtThemePreference): void {
  applyArtThemeClass(mode);
  if (typeof document === "undefined") return;
  document.cookie = `${ART_THEME_COOKIE}=${mode}; path=/; max-age=${ART_THEME_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  try {
    localStorage.setItem(ART_THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export const ART_THEME_INIT_SNIPPET = `(function(){try{var k="theme",c="lax_theme",m=localStorage.getItem(k);if(m!=="light"&&m!=="dark"){var p=document.cookie.match(new RegExp("(?:^|; )"+c+"=([^;]*)"));m=p?decodeURIComponent(p[1]):null}if(m!=="light"&&m!=="dark"){m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.toggle("dark",m==="dark")}catch(e){}})();`;
