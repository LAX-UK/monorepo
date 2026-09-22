export const SHOP_THEME_COOKIE = "lax_theme";
export const SHOP_THEME_STORAGE_KEY = "theme";
export const SHOP_THEME_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;
export const SHOP_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export type ShopThemePreference = "light" | "dark";

export function parseShopTheme(raw: string | null | undefined): ShopThemePreference | null {
  if (raw === "light" || raw === "dark") return raw;
  return null;
}

export function shopThemeIsDark(
  preference: ShopThemePreference | null,
  prefersDark: boolean,
): boolean {
  if (preference === "dark") return true;
  if (preference === "light") return false;
  return prefersDark;
}

export function toggleShopTheme(isDark: boolean): ShopThemePreference {
  return isDark ? "light" : "dark";
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

/** Toggle `<html class="dark">` without I/O. */
function applyShopThemeClass(mode: ShopThemePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
}

/** Persist preference to cookie + localStorage. */
function persistShopTheme(mode: ShopThemePreference): void {
  if (typeof document === "undefined") return;
  try {
    localStorage.setItem(SHOP_THEME_STORAGE_KEY, mode);
  } catch {
    /* quota / private mode */
  }
  document.cookie = `${SHOP_THEME_COOKIE}=${encodeURIComponent(mode)};path=/;max-age=${SHOP_THEME_COOKIE_MAX_AGE_SEC};SameSite=Lax`;
}

/** Apply light/dark class and persist for the next visit. */
export function applyShopTheme(mode: ShopThemePreference): void {
  applyShopThemeClass(mode);
  persistShopTheme(mode);
}

export function readShopThemeFromDocument(): ShopThemePreference | null {
  return parseShopTheme(readCookie(SHOP_THEME_COOKIE));
}

/** Inline bootstrap: cookie → localStorage → prefers-color-scheme. */
export const SHOP_THEME_INIT_SNIPPET = `(function(){try{var d=document.documentElement;function readCookie(n){var a=document.cookie.split(";"),i=0,p,e;for(;i<a.length;i++){p=a[i].trim();e=p.indexOf("=");if(e>0&&p.slice(0,e)===n)return decodeURIComponent(p.slice(e+1));}return null;}function valid(v){return v==="dark"||v==="light";}function prefersDark(){return window.matchMedia(${JSON.stringify(SHOP_THEME_MEDIA_QUERY)}).matches;}var ct=readCookie(${JSON.stringify(SHOP_THEME_COOKIE)}),ls=window.localStorage.getItem(${JSON.stringify(SHOP_THEME_STORAGE_KEY)}),pref=valid(ct)?ct:(valid(ls)?ls:null);d.classList.toggle("dark",pref==="dark"||(pref!=="light"&&prefersDark()));}catch(e){}})();`;
