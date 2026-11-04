/**
 * Who a flash message is for. Each audience has its own cookie, its own signing-key context and
 * its own set of pages, so a message written for one can never be read or replayed by the other.
 */
export type FlashAudience = {
  /** Name of the cookie that carries the message. */
  cookie: string;
  /** Mixed into the signing key so the audiences never share a key. */
  keyContext: string;
  /** True for a clean page path this audience may leave a message on. */
  isFlashablePath(path: string): boolean;
};

const MAX_PATH_LENGTH = 300;

/** Printable ASCII only, and none of the characters that end a cookie path or start a query. */
const COOKIE_PATH_SAFE = /^[\x21-\x7e]+$/;
const COOKIE_PATH_BREAKERS = /[;,?#\\]/;

/** A path under `root`, with no query, fragment or dot segments, short enough for a cookie path. */
export function pathUnder(root: string, path: string): boolean {
  if (path.length > MAX_PATH_LENGTH) return false;
  if (!COOKIE_PATH_SAFE.test(path) || COOKIE_PATH_BREAKERS.test(path)) return false;
  if (path !== root && !path.startsWith(`${root}/`)) return false;
  return !path.split("/").some((segment) => segment === "." || segment === "..");
}
