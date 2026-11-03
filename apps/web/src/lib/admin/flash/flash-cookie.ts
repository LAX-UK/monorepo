import { type AdminFlash, signAdminFlash, verifyAdminFlash } from "./flash-token";

/**
 * The cookie that carries an admin flash message to the next render of one page. It is scoped to
 * that page's path, short-lived and HttpOnly; the page reads it once and the browser is told to
 * drop it straight away.
 */
export const ADMIN_FLASH_COOKIE = "lax-admin-flash";

const MAX_PATH_LENGTH = 300;

/** The part of a cookie store the flash needs; Next's request cookies satisfy it. */
export type FlashCookieJar = {
  getAll(name: string): { value: string }[];
  set(
    name: string,
    value: string,
    options: {
      path: string;
      maxAge: number;
      httpOnly: true;
      sameSite: "lax";
      secure: boolean;
    },
  ): unknown;
};

export type FlashCookieEnv = { key: Buffer; nowMs: number; secure: boolean };

/** A staff page path with no query, fragment, dot segments or characters a cookie path would break on. */
export function isFlashablePath(path: string): boolean {
  if (path.length > MAX_PATH_LENGTH || !path.startsWith("/admin")) return false;
  if (path !== "/admin" && !path.startsWith("/admin/")) return false;
  if (/[?#;,\\\s]/.test(path)) return false;
  return !path.split("/").some((segment) => segment === "." || segment === "..");
}

function cookieOptions(path: string, maxAge: number, secure: boolean) {
  return { path, maxAge, httpOnly: true, sameSite: "lax", secure } as const;
}

/** Stores the message for the next visit to `path`. Returns false when it could not be stored. */
export function writeAdminFlash(
  jar: FlashCookieJar,
  env: FlashCookieEnv,
  flash: AdminFlash & { path: string },
): boolean {
  if (!isFlashablePath(flash.path)) return false;
  const token = signAdminFlash(flash, env.key, env.nowMs);
  if (!token) return false;
  jar.set(ADMIN_FLASH_COOKIE, token, cookieOptions(flash.path, 60, env.secure));
  return true;
}

/**
 * The message waiting for `path`, if a valid one is. A browser may hold one cookie per path, so
 * every copy is checked and the first that verifies for this path wins.
 */
export function readAdminFlash(
  jar: FlashCookieJar,
  env: Pick<FlashCookieEnv, "key" | "nowMs">,
  path: string,
): AdminFlash | null {
  for (const { value } of jar.getAll(ADMIN_FLASH_COOKIE)) {
    const flash = verifyAdminFlash(value, env.key, env.nowMs, path);
    if (flash) return flash;
  }
  return null;
}

/** Tells the browser to drop the message stored for `path`. */
export function clearAdminFlash(
  jar: FlashCookieJar,
  env: Pick<FlashCookieEnv, "secure">,
  path: string,
): boolean {
  if (!isFlashablePath(path)) return false;
  jar.set(ADMIN_FLASH_COOKIE, "", cookieOptions(path, 0, env.secure));
  return true;
}
