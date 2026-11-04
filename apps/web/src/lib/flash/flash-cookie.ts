import type { FlashAudience } from "./flash-audience";
import { type Flash, signFlash, verifyFlash } from "./flash-token";

/**
 * The cookie that carries a flash message to the next render of one page. It is scoped to that
 * page's path, short-lived and HttpOnly; the page reads it once and the browser is told to drop
 * it straight away.
 */

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

function cookieOptions(path: string, maxAge: number, secure: boolean) {
  return { path, maxAge, httpOnly: true, sameSite: "lax", secure } as const;
}

/** Stores the message for the next visit to `path`. Returns false when it could not be stored. */
export function writeFlash(
  audience: FlashAudience,
  jar: FlashCookieJar,
  env: FlashCookieEnv,
  flash: Flash & { path: string },
): boolean {
  if (!audience.isFlashablePath(flash.path)) return false;
  const token = signFlash(flash, env.key, env.nowMs);
  if (!token) return false;
  jar.set(audience.cookie, token, cookieOptions(flash.path, 60, env.secure));
  return true;
}

/**
 * The message waiting for `path`, if a valid one is. A browser may hold one cookie per path, so
 * every copy is checked and the first that verifies for this path wins.
 */
export function readFlash(
  audience: FlashAudience,
  jar: FlashCookieJar,
  env: Pick<FlashCookieEnv, "key" | "nowMs">,
  path: string,
): Flash | null {
  for (const { value } of jar.getAll(audience.cookie)) {
    const flash = verifyFlash(value, env.key, env.nowMs, path);
    if (flash) return flash;
  }
  return null;
}

/** Tells the browser to drop the message stored for `path`. */
export function clearFlash(
  audience: FlashAudience,
  jar: FlashCookieJar,
  env: Pick<FlashCookieEnv, "secure">,
  path: string,
): boolean {
  if (!audience.isFlashablePath(path)) return false;
  jar.set(audience.cookie, "", cookieOptions(path, 0, env.secure));
  return true;
}
