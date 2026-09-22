import type { Page } from "@playwright/test";

const THEME_COOKIE = "lax_theme";
const THEME_STORAGE_KEY = "theme";
const THEME_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** Match storefront bootstrap: cookie wins over localStorage over system preference. */
const themePayload = (mode: "light" | "dark") => ({
  mode,
  cookieName: THEME_COOKIE,
  storageKey: THEME_STORAGE_KEY,
  maxAgeSec: THEME_COOKIE_MAX_AGE_SEC,
});

function applyThemeInDocument({
  mode,
  cookieName,
  storageKey,
  maxAgeSec,
}: ReturnType<typeof themePayload>) {
  try {
    localStorage.setItem(storageKey, mode);
  } catch {
    /* private mode */
  }
  document.cookie = `${cookieName}=${encodeURIComponent(mode)};path=/;max-age=${maxAgeSec};SameSite=Lax`;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}

export async function applyShopThemeForE2e(page: Page, theme: "light" | "dark") {
  const payload = themePayload(theme);
  await page.addInitScript(applyThemeInDocument, payload);
}

/** Re-apply after hydration when client theme bootstrap races visual captures (common on mobile). */
export async function syncShopThemeForE2e(page: Page, theme: "light" | "dark") {
  await page.evaluate(applyThemeInDocument, themePayload(theme));
}
